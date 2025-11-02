from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timedelta
from app.config.database import get_connection
from app.middleware.auth import authenticate_token
from fastapi import Depends
from fastapi.responses import Response
import json
import io
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
import oracledb

router = APIRouter()

@router.get("/report/monthly-expenditure")
async def get_monthly_expenditure_report(
    month: int = Query(...), 
    year: int = Query(...), 
    user: dict = Depends(authenticate_token)
):
    try:
        conn = await get_connection()
        cursor = conn.cursor()
        
        # Use direct SQL query
        cursor.execute("""
            SELECT 
                category,
                COUNT(*) as transaction_count,
                SUM(amount) as total_amount,
                ROUND(AVG(amount), 2) as avg_amount,
                ROUND((SUM(amount) / (SELECT NVL(SUM(amount), 1) FROM transactions 
                     WHERE user_id = :user_id 
                     AND EXTRACT(MONTH FROM transaction_date) = :month 
                     AND EXTRACT(YEAR FROM transaction_date) = :year 
                     AND type = 'expense')) * 100, 2) as percentage
            FROM transactions 
            WHERE user_id = :user_id 
                AND type = 'expense'
                AND EXTRACT(MONTH FROM transaction_date) = :month 
                AND EXTRACT(YEAR FROM transaction_date) = :year 
            GROUP BY category
            ORDER BY total_amount DESC
        """, user_id=user["id"], month=month, year=year)
        
        rows = cursor.fetchall()
        
        categories = []
        for row in rows:
            categories.append({
                "category": row[0],
                "transaction_count": row[1],
                "total_amount": float(row[2]) if row[2] else 0,
                "avg_amount": float(row[3]) if row[3] else 0,
                "percentage": float(row[4]) if row[4] else 0
            })
        
        # Get total expenses for the month
        cursor.execute("""
            SELECT NVL(SUM(amount), 0) FROM transactions 
            WHERE user_id = :user_id 
            AND type = 'expense'
            AND EXTRACT(MONTH FROM transaction_date) = :month 
            AND EXTRACT(YEAR FROM transaction_date) = :year
        """, user_id=user["id"], month=month, year=year)
        
        total_expenses_result = cursor.fetchone()
        total_expenses = float(total_expenses_result[0]) if total_expenses_result else 0
        
        cursor.close()
        
        return {
            "success": True,
            "data": {
                "period": {
                    "month": month,
                    "year": year,
                    "monthName": datetime(2000, month, 1).strftime("%B")
                },
                "categories": categories,
                "summary": {
                    "total_expenses": total_expenses,
                    "category_count": len(categories)
                },
                "generatedAt": datetime.now().isoformat()
            }
        }
    except Exception as e:
        print(f"Error in monthly expenditure report: {str(e)}")
        raise HTTPException(500, {"success": False, "message": "Failed to generate monthly expenditure report", "error": str(e)})

@router.get("/report/goal-adherence")
async def get_goal_adherence_report(
    year: int = Query(...), 
    user: dict = Depends(authenticate_token)
):
    try:
        conn = await get_connection()
        cursor = conn.cursor()
        
        # Use direct SQL query
        cursor.execute("""
            SELECT 
                g.target_month,
                g.target_year,
                g.target_amount,
                NVL(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) as actual_savings,
                CASE 
                    WHEN NVL(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) >= g.target_amount THEN 'ACHIEVED'
                    WHEN NVL(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) >= g.target_amount * 0.7 THEN 'NEAR_TARGET'
                    ELSE 'BELOW_TARGET'
                END as status,
                ROUND((NVL(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) / g.target_amount) * 100, 2) as achievement_rate
            FROM goals g
            LEFT JOIN transactions t ON g.user_id = t.user_id
                AND EXTRACT(MONTH FROM t.transaction_date) = g.target_month
                AND EXTRACT(YEAR FROM t.transaction_date) = g.target_year
            WHERE g.user_id = :user_id 
                AND g.target_year = :year
            GROUP BY g.target_month, g.target_year, g.target_amount
            ORDER BY g.target_month
        """, user_id=user["id"], year=year)
        
        rows = cursor.fetchall()
        
        goals = []
        total_goals = len(rows)
        achieved_goals = 0
        
        for row in rows:
            goal_data = {
                "target_month": row[0],
                "target_year": row[1],
                "target_amount": float(row[2]) if row[2] else 0,
                "actual_savings": float(row[3]) if row[3] else 0,
                "status": row[4],
                "achievement_rate": float(row[5]) if row[5] else 0
            }
            
            if row[4] == 'ACHIEVED':
                achieved_goals += 1
                
            goals.append(goal_data)
        
        achievement_rate = (achieved_goals / total_goals * 100) if total_goals > 0 else 0
        
        cursor.close()
        
        return {
            "success": True,
            "data": {
                "period": {"year": year},
                "goals": goals,
                "summary": {
                    "total_goals": total_goals,
                    "achieved_goals": achieved_goals,
                    "achievement_rate": achievement_rate
                },
                "generatedAt": datetime.now().isoformat()
            }
        }
    except Exception as e:
        print(f"Error in goal adherence report: {str(e)}")
        raise HTTPException(500, {"success": False, "message": "Failed to generate goal adherence report", "error": str(e)})

@router.get("/report/savings-progress")
async def get_savings_progress_report(user: dict = Depends(authenticate_token)):
    try:
        conn = await get_connection()
        cursor = conn.cursor()
        
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        # Use direct SQL query
        cursor.execute("""
            SELECT 
                g.target_month,
                g.target_year,
                g.target_amount,
                NVL(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) as current_savings,
                ROUND((NVL(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) / g.target_amount) * 100, 2) as progress_percentage,
                CASE 
                    WHEN NVL(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) >= g.target_amount THEN 'ACHIEVED'
                    ELSE 'IN_PROGRESS'
                END as status
            FROM goals g
            LEFT JOIN transactions t ON g.user_id = t.user_id
                AND EXTRACT(MONTH FROM t.transaction_date) = g.target_month
                AND EXTRACT(YEAR FROM t.transaction_date) = g.target_year
            WHERE g.user_id = :user_id 
                AND g.target_month = :current_month
                AND g.target_year = :current_year
            GROUP BY g.target_month, g.target_year, g.target_amount
        """, user_id=user["id"], current_month=current_month, current_year=current_year)
        
        rows = cursor.fetchall()
        
        current_goals = []
        for row in rows:
            current_goals.append({
                "target_month": row[0],
                "target_year": row[1],
                "target_amount": float(row[2]) if row[2] else 0,
                "current_savings": float(row[3]) if row[3] else 0,
                "progress_percentage": float(row[4]) if row[4] else 0,
                "status": row[5]
            })
        
        cursor.close()
        
        return {
            "success": True,
            "data": {
                "current_goals": current_goals,
                "period": {
                    "month": current_month,
                    "year": current_year
                },
                "generatedAt": datetime.now().isoformat()
            }
        }
    except Exception as e:
        print(f"Error in savings progress report: {str(e)}")
        raise HTTPException(500, {"success": False, "message": "Failed to generate savings progress report", "error": str(e)})

@router.get("/report/category-distribution")
async def get_category_distribution_report(
    start_date: str = Query(...),
    end_date: str = Query(...),
    user: dict = Depends(authenticate_token)
):
    try:
        conn = await get_connection()
        cursor = conn.cursor()
        
        # Use direct SQL query
        cursor.execute("""
            SELECT
                category,
                COUNT(*) as transaction_count,
                SUM(amount) as total_amount,
                ROUND(AVG(amount), 2) as avg_amount,
                ROUND((SUM(amount) / (SELECT NVL(SUM(amount), 1) FROM transactions 
                     WHERE user_id = :user_id 
                     AND type = 'expense'
                     AND transaction_date BETWEEN TO_DATE(:start_date, 'YYYY-MM-DD') 
                     AND TO_DATE(:end_date, 'YYYY-MM-DD'))) * 100, 2) as percentage
            FROM transactions 
            WHERE user_id = :user_id 
                AND type = 'expense'
                AND transaction_date BETWEEN TO_DATE(:start_date, 'YYYY-MM-DD') 
                AND TO_DATE(:end_date, 'YYYY-MM-DD')
            GROUP BY category
            ORDER BY total_amount DESC
        """, user_id=user["id"], start_date=start_date, end_date=end_date)
        
        rows = cursor.fetchall()
        
        categories = []
        for row in rows:
            categories.append({
                "category": row[0],
                "transaction_count": row[1],
                "total_amount": float(row[2]) if row[2] else 0,
                "avg_amount": float(row[3]) if row[3] else 0,
                "percentage": float(row[4]) if row[4] else 0
            })
        
        cursor.close()
        
        return {
            "success": True,
            "data": {
                "period": {
                    "start_date": start_date,
                    "end_date": end_date
                },
                "categories": categories,
                "summary": {
                    "total_categories": len(categories),
                    "total_expenses": sum(cat["total_amount"] for cat in categories)
                },
                "generatedAt": datetime.now().isoformat()
            }
        }
    except Exception as e:
        print(f"Error in category distribution report: {str(e)}")
        raise HTTPException(500, {"success": False, "message": "Failed to generate category distribution report", "error": str(e)})

@router.get("/report/financial-health")
async def get_financial_health_report(user: dict = Depends(authenticate_token)):
    try:
        conn = await get_connection()
        cursor = conn.cursor()
        
        current_year = datetime.now().year
        
        # Use direct SQL query
        cursor.execute("""
            SELECT 
                NVL(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
                NVL(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
                NVL(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as net_income,
                CASE 
                    WHEN NVL(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) > 0 THEN
                        ROUND((NVL(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) / 
                              NVL(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 1)) * 100, 2)
                    ELSE 0
                END as savings_rate
            FROM transactions 
            WHERE user_id = :user_id 
                AND EXTRACT(YEAR FROM transaction_date) = :current_year
        """, user_id=user["id"], current_year=current_year)
        
        financial_data = cursor.fetchone()
        
        if financial_data:
            total_income = float(financial_data[0]) if financial_data[0] else 0
            total_expenses = float(financial_data[1]) if financial_data[1] else 0
            net_income = float(financial_data[2]) if financial_data[2] else 0
            savings_rate = float(financial_data[3]) if financial_data[3] else 0
        else:
            total_income = 0
            total_expenses = 0
            net_income = 0
            savings_rate = 0
        
        # Get goals data
        cursor.execute("""
            SELECT COUNT(*) FROM goals WHERE user_id = :user_id AND target_year = :current_year
        """, user_id=user["id"], current_year=current_year)
        
        total_goals_result = cursor.fetchone()
        total_goals = total_goals_result[0] if total_goals_result else 0
        
        # Get achieved goals
        cursor.execute("""
            SELECT COUNT(*) 
            FROM goals g
            WHERE g.user_id = :user_id 
            AND g.target_year = :current_year
            AND g.target_amount <= (
                SELECT NVL(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0)
                FROM transactions 
                WHERE user_id = :user_id
                AND EXTRACT(MONTH FROM transaction_date) = g.target_month
                AND EXTRACT(YEAR FROM transaction_date) = g.target_year
            )
        """, user_id=user["id"], current_year=current_year)
        
        achieved_goals_result = cursor.fetchone()
        achieved_goals = achieved_goals_result[0] if achieved_goals_result else 0
        
        goal_achievement_rate = (achieved_goals / total_goals * 100) if total_goals > 0 else 0
        
        # Calculate health score
        health_score = min(
            (min(savings_rate, 30) + 
             (goal_achievement_rate * 0.4) + 
             (20 if net_income > 0 else 0)), 
            100
        )
        
        if health_score >= 80:
            health_status = "EXCELLENT"
        elif health_score >= 60:
            health_status = "GOOD"
        elif health_score >= 40:
            health_status = "FAIR"
        else:
            health_status = "POOR"
        
        health_data = {
            "total_income": total_income,
            "total_expenses": total_expenses,
            "net_income": net_income,
            "savings_rate": savings_rate,
            "goal_achievement_rate": goal_achievement_rate,
            "health_score": health_score,
            "health_status": health_status
        }
        
        # Generate recommendations based on health score
        recommendations = generate_health_recommendations(health_data)
        
        cursor.close()
        
        return {
            "success": True,
            "data": {
                "health_metrics": health_data,
                "recommendations": recommendations,
                "period": {"year": current_year},
                "generatedAt": datetime.now().isoformat()
            }
        }
    except Exception as e:
        print(f"Error in financial health report: {str(e)}")
        raise HTTPException(500, {"success": False, "message": "Failed to generate financial health report", "error": str(e)})

def generate_health_recommendations(health_data):
    recommendations = []
    
    if health_data["savings_rate"] < 20:
        recommendations.append("Increase your savings rate by reducing discretionary spending")
    
    if health_data["goal_achievement_rate"] < 60:
        recommendations.append("Set more realistic financial goals and track progress regularly")
    
    if health_data["health_score"] < 40:
        recommendations.append("Consider consulting with a financial advisor for personalized advice")
    
    if health_data["net_income"] < 0:
        recommendations.append("Focus on reducing expenses or increasing income to achieve positive cash flow")
    
    if not recommendations:
        recommendations.append("Continue with your current financial strategies - you're doing great!")
    
    return recommendations

# PDF Generation Endpoints for all 5 reports
@router.get("/report/monthly-expenditure/pdf")
async def generate_monthly_expenditure_pdf(
    month: int = Query(...), 
    year: int = Query(...), 
    user: dict = Depends(authenticate_token)
):
    try:
        # Get the report data using the same endpoint
        report_response = await get_monthly_expenditure_report(month, year, user)
        if not report_response["success"]:
            raise HTTPException(500, {"success": False, "message": "Failed to generate report data"})
        
        report_data = report_response["data"]
        
        # Generate PDF
        pdf_buffer = generate_monthly_expenditure_pdf_content(report_data, user)
        
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=monthly_expenditure_{month}_{year}.pdf"
            }
        )
    except Exception as e:
        print(f"Error generating PDF: {str(e)}")
        raise HTTPException(500, {"success": False, "message": "Failed to generate PDF report", "error": str(e)})

@router.get("/report/goal-adherence/pdf")
async def generate_goal_adherence_pdf(
    year: int = Query(...), 
    user: dict = Depends(authenticate_token)
):
    try:
        # Get the report data using the same endpoint
        report_response = await get_goal_adherence_report(year, user)
        if not report_response["success"]:
            raise HTTPException(500, {"success": False, "message": "Failed to generate report data"})
        
        report_data = report_response["data"]
        
        # Generate PDF
        pdf_buffer = generate_goal_adherence_pdf_content(report_data, user)
        
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=goal_adherence_{year}.pdf"
            }
        )
    except Exception as e:
        print(f"Error generating PDF: {str(e)}")
        raise HTTPException(500, {"success": False, "message": "Failed to generate PDF report", "error": str(e)})

@router.get("/report/savings-progress/pdf")
async def generate_savings_progress_pdf(user: dict = Depends(authenticate_token)):
    try:
        # Get the report data using the same endpoint
        report_response = await get_savings_progress_report(user)
        if not report_response["success"]:
            raise HTTPException(500, {"success": False, "message": "Failed to generate report data"})
        
        report_data = report_response["data"]
        
        # Generate PDF
        pdf_buffer = generate_savings_progress_pdf_content(report_data, user)
        
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=savings_progress_{datetime.now().month}_{datetime.now().year}.pdf"
            }
        )
    except Exception as e:
        print(f"Error generating PDF: {str(e)}")
        raise HTTPException(500, {"success": False, "message": "Failed to generate PDF report", "error": str(e)})

@router.get("/report/category-distribution/pdf")
async def generate_category_distribution_pdf(
    start_date: str = Query(...),
    end_date: str = Query(...),
    user: dict = Depends(authenticate_token)
):
    try:
        # Get the report data using the same endpoint
        report_response = await get_category_distribution_report(start_date, end_date, user)
        if not report_response["success"]:
            raise HTTPException(500, {"success": False, "message": "Failed to generate report data"})
        
        report_data = report_response["data"]
        
        # Generate PDF
        pdf_buffer = generate_category_distribution_pdf_content(report_data, user)
        
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=category_distribution_{start_date}_to_{end_date}.pdf"
            }
        )
    except Exception as e:
        print(f"Error generating PDF: {str(e)}")
        raise HTTPException(500, {"success": False, "message": "Failed to generate PDF report", "error": str(e)})

@router.get("/report/financial-health/pdf")
async def generate_financial_health_pdf(user: dict = Depends(authenticate_token)):
    try:
        # Get the report data using the same endpoint
        report_response = await get_financial_health_report(user)
        if not report_response["success"]:
            raise HTTPException(500, {"success": False, "message": "Failed to generate report data"})
        
        report_data = report_response["data"]
        
        # Generate PDF
        pdf_buffer = generate_financial_health_pdf_content(report_data, user)
        
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=financial_health_{datetime.now().year}.pdf"
            }
        )
    except Exception as e:
        print(f"Error generating PDF: {str(e)}")
        raise HTTPException(500, {"success": False, "message": "Failed to generate PDF report", "error": str(e)})

# PDF Generation Functions for each report type
def generate_monthly_expenditure_pdf_content(data, user):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=30,
        alignment=1,
        textColor=colors.HexColor("#6366F1")
    )
    title = Paragraph(f"Monthly Expenditure Report - {data['period']['monthName']} {data['period']['year']}", title_style)
    story.append(title)
    
    # Summary
    story.append(Paragraph("Summary", styles['Heading2']))
    summary_data = [
        ['Total Expenses', f"${data['summary']['total_expenses']:.2f}"],
        ['Categories', str(data['summary']['category_count'])],
        ['Period', f"{data['period']['monthName']} {data['period']['year']}"]
    ]
    
    summary_table = Table(summary_data, colWidths=[200, 200])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#6366F1")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#F8FAFC")),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 20))
    
    # Categories
    if data['categories']:
        story.append(Paragraph("Expense Categories", styles['Heading2']))
        category_data = [['Category', 'Transactions', 'Total Amount', 'Percentage']]
        for cat in data['categories']:
            category_data.append([
                cat['category'],
                str(cat['transaction_count']),
                f"${cat['total_amount']:.2f}",
                f"{cat['percentage']:.1f}%"
            ])
        
        category_table = Table(category_data, colWidths=[150, 100, 100, 100])
        category_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#6366F1")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#F8FAFC")),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(category_table)
    
    # Footer
    story.append(Spacer(1, 20))
    generated_at = datetime.fromisoformat(data['generatedAt']).strftime("%B %d, %Y at %H:%M")
    footer = Paragraph(f"Generated on {generated_at} for {user['name']}", styles['Normal'])
    story.append(footer)
    
    doc.build(story)
    buffer.seek(0)
    return buffer

def generate_goal_adherence_pdf_content(data, user):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=30,
        alignment=1,
        textColor=colors.HexColor("#6366F1")
    )
    title = Paragraph(f"Goal Adherence Report - {data['period']['year']}", title_style)
    story.append(title)
    
    # Summary
    story.append(Paragraph("Summary", styles['Heading2']))
    summary_data = [
        ['Total Goals', str(data['summary']['total_goals'])],
        ['Achieved Goals', str(data['summary']['achieved_goals'])],
        ['Achievement Rate', f"{data['summary']['achievement_rate']:.1f}%"]
    ]
    
    summary_table = Table(summary_data, colWidths=[200, 200])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#6366F1")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#F8FAFC")),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 20))
    
    # Goals
    if data['goals']:
        story.append(Paragraph("Goal Details", styles['Heading2']))
        goal_data = [['Month', 'Target Amount', 'Actual Savings', 'Status', 'Achievement']]
        for goal in data['goals']:
            month_name = datetime(2000, goal['target_month'], 1).strftime("%B")
            goal_data.append([
                f"{month_name} {goal['target_year']}",
                f"${goal['target_amount']:.2f}",
                f"${goal['actual_savings']:.2f}",
                goal['status'].replace('_', ' ').title(),
                f"{goal['achievement_rate']:.1f}%"
            ])
        
        goal_table = Table(goal_data, colWidths=[120, 100, 100, 100, 80])
        goal_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#6366F1")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#F8FAFC")),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(goal_table)
    
    # Footer
    story.append(Spacer(1, 20))
    generated_at = datetime.fromisoformat(data['generatedAt']).strftime("%B %d, %Y at %H:%M")
    footer = Paragraph(f"Generated on {generated_at} for {user['name']}", styles['Normal'])
    story.append(footer)
    
    doc.build(story)
    buffer.seek(0)
    return buffer

def generate_savings_progress_pdf_content(data, user):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=30,
        alignment=1,
        textColor=colors.HexColor("#6366F1")
    )
    title = Paragraph(f"Savings Progress Report - {data['period']['monthName']} {data['period']['year']}", title_style)
    story.append(title)
    
    # Current Goals
    if data['current_goals']:
        story.append(Paragraph("Current Savings Goals", styles['Heading2']))
        for goal in data['current_goals']:
            goal_data = [
                ['Target Amount', f"${goal['target_amount']:.2f}"],
                ['Current Savings', f"${goal['current_savings']:.2f}"],
                ['Progress', f"{goal['progress_percentage']:.1f}%"],
                ['Status', goal['status'].replace('_', ' ').title()]
            ]
            
            goal_table = Table(goal_data, colWidths=[150, 150])
            goal_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#10B981")),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#F8FAFC")),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(goal_table)
            story.append(Spacer(1, 10))
    else:
        story.append(Paragraph("No active savings goals for the current month", styles['Normal']))
    
    # Footer
    story.append(Spacer(1, 20))
    generated_at = datetime.fromisoformat(data['generatedAt']).strftime("%B %d, %Y at %H:%M")
    footer = Paragraph(f"Generated on {generated_at} for {user['name']}", styles['Normal'])
    story.append(footer)
    
    doc.build(story)
    buffer.seek(0)
    return buffer

def generate_category_distribution_pdf_content(data, user):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=30,
        alignment=1,
        textColor=colors.HexColor("#6366F1")
    )
    title = Paragraph("Category Distribution Report", title_style)
    story.append(title)
    
    # Period
    story.append(Paragraph(f"Period: {data['period']['start_date']} to {data['period']['end_date']}", styles['Heading2']))
    
    # Summary
    story.append(Paragraph("Summary", styles['Heading3']))
    summary_data = [
        ['Total Expenses', f"${data['summary']['total_expenses']:.2f}"],
        ['Categories', str(data['summary']['total_categories'])]
    ]
    
    summary_table = Table(summary_data, colWidths=[200, 200])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#6366F1")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#F8FAFC")),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 20))
    
    # Categories
    if data['categories']:
        story.append(Paragraph("Expense Categories", styles['Heading2']))
        category_data = [['Category', 'Transactions', 'Total Amount', 'Percentage']]
        for cat in data['categories']:
            category_data.append([
                cat['category'],
                str(cat['transaction_count']),
                f"${cat['total_amount']:.2f}",
                f"{cat['percentage']:.1f}%"
            ])
        
        category_table = Table(category_data, colWidths=[150, 100, 100, 100])
        category_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#6366F1")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#F8FAFC")),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(category_table)
    
    # Footer
    story.append(Spacer(1, 20))
    generated_at = datetime.fromisoformat(data['generatedAt']).strftime("%B %d, %Y at %H:%M")
    footer = Paragraph(f"Generated on {generated_at} for {user['name']}", styles['Normal'])
    story.append(footer)
    
    doc.build(story)
    buffer.seek(0)
    return buffer

def generate_financial_health_pdf_content(data, user):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=30,
        alignment=1,
        textColor=colors.HexColor("#6366F1")
    )
    title = Paragraph(f"Financial Health Report - {data['period']['year']}", title_style)
    story.append(title)
    
    # Health Metrics
    story.append(Paragraph("Financial Health Metrics", styles['Heading2']))
    metrics = data['health_metrics']
    
    metrics_data = [
        ['Metric', 'Value'],
        ['Total Income', f"${metrics['total_income']:.2f}"],
        ['Total Expenses', f"${metrics['total_expenses']:.2f}"],
        ['Net Income', f"${metrics['net_income']:.2f}"],
        ['Savings Rate', f"{metrics['savings_rate']:.1f}%"],
        ['Goal Achievement Rate', f"{metrics['goal_achievement_rate']:.1f}%"],
        ['Health Score', f"{metrics['health_score']:.1f}/100"],
        ['Health Status', metrics['health_status']]
    ]
    
    metrics_table = Table(metrics_data, colWidths=[200, 200])
    metrics_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#6366F1")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#F8FAFC")),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    story.append(metrics_table)
    story.append(Spacer(1, 20))
    
    # Recommendations
    if data.get('recommendations'):
        story.append(Paragraph("Recommendations", styles['Heading2']))
        for rec in data['recommendations']:
            story.append(Paragraph(f"• {rec}", styles['Normal']))
    
    # Footer
    story.append(Spacer(1, 20))
    generated_at = datetime.fromisoformat(data['generatedAt']).strftime("%B %d, %Y at %H:%M")
    footer = Paragraph(f"Generated on {generated_at} for {user['name']}", styles['Normal'])
    story.append(footer)
    
    doc.build(story)
    buffer.seek(0)
    return buffer