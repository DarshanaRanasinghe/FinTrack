from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from app.config.database import get_connection
from app.middleware.auth import authenticate_token
from fastapi import Depends
from fastapi.responses import Response
import json
import io
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

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
        
        # Call the stored procedure
        result_cursor = cursor.var(oracledb.CURSOR)
        cursor.callproc('get_monthly_expenditure_analysis', [user["id"], month, year, result_cursor])
        
        result = result_cursor.getvalue()
        rows = result.fetchall()
        
        categories = []
        for row in rows:
            categories.append({
                "category": row[0],
                "transaction_count": row[1],
                "total_amount": float(row[2]),
                "avg_amount": float(row[3]),
                "percentage": float(row[4])
            })
        
        # Get total expenses for the month
        cursor.execute("""
            SELECT SUM(amount) FROM transactions 
            WHERE user_id = :user_id 
            AND type = 'expense'
            AND EXTRACT(MONTH FROM transaction_date) = :month 
            AND EXTRACT(YEAR FROM transaction_date) = :year
        """, {"user_id": user["id"], "month": month, "year": year})
        
        total_expenses = cursor.fetchone()[0] or 0
        
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
                    "total_expenses": float(total_expenses),
                    "category_count": len(categories)
                },
                "generatedAt": datetime.now().isoformat()
            }
        }
    except Exception as e:
        raise HTTPException(500, {"success": False, "message": "Failed to generate monthly expenditure report", "error": str(e)})

@router.get("/report/goal-adherence")
async def get_goal_adherence_report(
    year: int = Query(...), 
    user: dict = Depends(authenticate_token)
):
    try:
        conn = await get_connection()
        cursor = conn.cursor()
        
        # Call the stored procedure
        result_cursor = cursor.var(oracledb.CURSOR)
        cursor.callproc('get_goal_adherence_tracking', [user["id"], year, result_cursor])
        
        result = result_cursor.getvalue()
        rows = result.fetchall()
        
        goals = []
        total_goals = len(rows)
        achieved_goals = 0
        
        for row in rows:
            goal_data = {
                "target_month": row[0],
                "target_year": row[1],
                "target_amount": float(row[2]),
                "actual_savings": float(row[3]),
                "status": row[4],
                "achievement_rate": float(row[5])
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
        raise HTTPException(500, {"success": False, "message": "Failed to generate goal adherence report", "error": str(e)})

@router.get("/report/savings-progress")
async def get_savings_progress_report(user: dict = Depends(authenticate_token)):
    try:
        conn = await get_connection()
        cursor = conn.cursor()
        
        # Call the stored procedure
        result_cursor = cursor.var(oracledb.CURSOR)
        cursor.callproc('get_savings_goal_progress', [user["id"], result_cursor])
        
        result = result_cursor.getvalue()
        rows = result.fetchall()
        
        current_goals = []
        for row in rows:
            current_goals.append({
                "target_month": row[0],
                "target_year": row[1],
                "target_amount": float(row[2]),
                "current_savings": float(row[3]),
                "progress_percentage": float(row[4]),
                "status": row[5]
            })
        
        cursor.close()
        
        return {
            "success": True,
            "data": {
                "current_goals": current_goals,
                "period": {
                    "month": datetime.now().month,
                    "year": datetime.now().year
                },
                "generatedAt": datetime.now().isoformat()
            }
        }
    except Exception as e:
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
        
        # Call the stored procedure
        result_cursor = cursor.var(oracledb.CURSOR)
        cursor.callproc('get_category_expense_distribution', [user["id"], start_date, end_date, result_cursor])
        
        result = result_cursor.getvalue()
        rows = result.fetchall()
        
        categories = []
        for row in rows:
            categories.append({
                "category": row[0],
                "transaction_count": row[1],
                "total_amount": float(row[2]),
                "avg_amount": float(row[3]),
                "percentage": float(row[4])
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
        raise HTTPException(500, {"success": False, "message": "Failed to generate category distribution report", "error": str(e)})

@router.get("/report/financial-health")
async def get_financial_health_report(user: dict = Depends(authenticate_token)):
    try:
        conn = await get_connection()
        cursor = conn.cursor()
        
        # Call the stored procedure
        result_cursor = cursor.var(oracledb.CURSOR)
        cursor.callproc('get_financial_health_status', [user["id"], result_cursor])
        
        result = result_cursor.getvalue()
        row = result.fetchone()
        
        health_data = {
            "total_income": float(row[0]),
            "total_expenses": float(row[1]),
            "net_income": float(row[2]),
            "savings_rate": float(row[3]),
            "goal_achievement_rate": float(row[4]),
            "health_score": float(row[5]),
            "health_status": row[6]
        }
        
        # Generate recommendations based on health score
        recommendations = generate_health_recommendations(health_data)
        
        cursor.close()
        
        return {
            "success": True,
            "data": {
                "health_metrics": health_data,
                "recommendations": recommendations,
                "period": {"year": datetime.now().year},
                "generatedAt": datetime.now().isoformat()
            }
        }
    except Exception as e:
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

# PDF Generation Endpoints
@router.get("/report/monthly-expenditure/pdf")
async def generate_monthly_expenditure_pdf(
    month: int = Query(...), 
    year: int = Query(...), 
    user: dict = Depends(authenticate_token)
):
    try:
        report_data = await get_monthly_expenditure_report(month, year, user)
        pdf_buffer = generate_basic_pdf(report_data["data"], "Monthly Expenditure Report", user)
        
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=monthly_expenditure_{month}_{year}.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(500, {"success": False, "message": "Failed to generate PDF report", "error": str(e)})

@router.get("/report/financial-health/pdf")
async def generate_financial_health_pdf(user: dict = Depends(authenticate_token)):
    try:
        report_data = await get_financial_health_report(user)
        pdf_buffer = generate_basic_pdf(report_data["data"], "Financial Health Report", user)
        
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=financial_health_{datetime.now().year}.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(500, {"success": False, "message": "Failed to generate PDF report", "error": str(e)})

def generate_basic_pdf(data, title, user):
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
    title_para = Paragraph(title, title_style)
    story.append(title_para)
    
    # Add basic content based on report type
    if "health_metrics" in data:
        # Financial Health Report
        metrics = data["health_metrics"]
        story.append(Paragraph("Financial Health Metrics", styles['Heading2']))
        
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
    
    elif "categories" in data:
        # Monthly Expenditure Report
        story.append(Paragraph(f"Expenditure for {data['period']['monthName']} {data['period']['year']}", styles['Heading2']))
        
        if data['categories']:
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