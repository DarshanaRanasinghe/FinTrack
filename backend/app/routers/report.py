from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from app.models.transaction import Transaction
from app.models.goal import Goal
from app.utils.helpers import calculate_transaction_analytics, calculate_monthly_summary, generate_chart_data, calculate_yearly_analytics, calculate_monthly_breakdown
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
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.piecharts import Pie
import base64

router = APIRouter()

@router.get("/report")
async def generate_report(month: int = Query(None), year: int = Query(None), user: dict = Depends(authenticate_token)):
    try:
        target_month = month or datetime.now().month
        target_year = year or datetime.now().year
        
        transactions = await Transaction.get_by_month(user["id"], target_month, target_year)
        goal = await Goal.get_by_user_and_month(user["id"], target_month, target_year)
        
        analytics = calculate_transaction_analytics(transactions)
        monthly_summary = calculate_monthly_summary(transactions, goal)
        chart_data = generate_chart_data(transactions, target_month, target_year)
        
        return {
            "success": True,
            "data": {
                "period": {
                    "month": target_month,
                    "year": target_year,
                    "monthName": datetime(2000, target_month, 1).strftime("%B")
                },
                "summary": monthly_summary,
                "analytics": analytics,
                "chartData": chart_data,
                "transactions": transactions[:50],
                "generatedAt": datetime.now().isoformat()
            }
        }
    except Exception as e:
        raise HTTPException(500, {"success": False, "message": "Failed to generate report", "error": str(e)})

@router.get("/report/yearly")
async def get_yearly_report(year: int = Query(None), user: dict = Depends(authenticate_token)):
    try:
        target_year = year or datetime.now().year
        
        all_transactions = await Transaction.get_all(user["id"])
        year_transactions = [t for t in all_transactions if datetime.strptime(t["date"], "%Y-%m-%d").year == target_year]
        
        all_goals = await Goal.get_user_goals(user["id"])
        year_goals = [g for g in all_goals if g["target_year"] == target_year]
        
        yearly_analytics = calculate_yearly_analytics(year_transactions, year_goals)
        monthly_breakdown = calculate_monthly_breakdown(year_transactions, target_year)
        
        return {
            "success": True,
            "data": {
                "period": {
                    "year": target_year,
                    "type": "yearly"
                },
                "summary": yearly_analytics,
                "monthlyBreakdown": monthly_breakdown,
                "goalsProgress": year_goals,
                "generatedAt": datetime.now().isoformat()
            }
        }
    except Exception as e:
        raise HTTPException(500, {"success": False, "message": "Failed to generate yearly report", "error": str(e)})

@router.get("/report/category-breakdown")
async def get_category_breakdown_report(month: int = Query(None), year: int = Query(None), user: dict = Depends(authenticate_token)):
    try:
        target_month = month or datetime.now().month
        target_year = year or datetime.now().year
        
        transactions = await Transaction.get_by_month(user["id"], target_month, target_year)
        analytics = calculate_transaction_analytics(transactions)
        
        # Calculate category percentages
        total_income = analytics["totals"]["income"]
        total_expenses = analytics["totals"]["expenses"]
        
        income_categories = []
        for category, amount in analytics["categoryBreakdown"]["income"].items():
            percentage = (amount / total_income * 100) if total_income > 0 else 0
            income_categories.append({
                "category": category,
                "amount": amount,
                "percentage": percentage
            })
        
        expense_categories = []
        for category, amount in analytics["categoryBreakdown"]["expenses"].items():
            percentage = (amount / total_expenses * 100) if total_expenses > 0 else 0
            expense_categories.append({
                "category": category,
                "amount": amount,
                "percentage": percentage
            })
        
        return {
            "success": True,
            "data": {
                "period": {
                    "month": target_month,
                    "year": target_year,
                    "monthName": datetime(2000, target_month, 1).strftime("%B")
                },
                "incomeCategories": sorted(income_categories, key=lambda x: x["amount"], reverse=True),
                "expenseCategories": sorted(expense_categories, key=lambda x: x["amount"], reverse=True),
                "summary": {
                    "totalIncome": total_income,
                    "totalExpenses": total_expenses,
                    "netIncome": total_income - total_expenses
                },
                "generatedAt": datetime.now().isoformat()
            }
        }
    except Exception as e:
        raise HTTPException(500, {"success": False, "message": "Failed to generate category breakdown report", "error": str(e)})

@router.get("/report/goal-progress")
async def get_goal_progress_report(year: int = Query(None), user: dict = Depends(authenticate_token)):
    try:
        target_year = year or datetime.now().year
        
        all_goals = await Goal.get_user_goals(user["id"])
        year_goals = [g for g in all_goals if g["target_year"] == target_year]
        
        goals_with_progress = []
        total_goals = len(year_goals)
        achieved_goals = 0
        
        for goal in year_goals:
            transactions = await Transaction.get_by_month(user["id"], goal["target_month"], goal["target_year"])
            analytics = calculate_transaction_analytics(transactions)
            progress = analytics["totals"]["net"]
            progress_percentage = (progress / goal["target_amount"] * 100) if goal["target_amount"] > 0 else 0
            achieved = progress >= goal["target_amount"]
            
            if achieved:
                achieved_goals += 1
            
            goals_with_progress.append({
                **goal,
                "progress": progress,
                "progressPercentage": min(progress_percentage, 100),
                "achieved": achieved,
                "remaining": max(goal["target_amount"] - progress, 0)
            })
        
        achievement_rate = (achieved_goals / total_goals * 100) if total_goals > 0 else 0
        
        return {
            "success": True,
            "data": {
                "period": {
                    "year": target_year,
                    "type": "yearly"
                },
                "goals": goals_with_progress,
                "summary": {
                    "totalGoals": total_goals,
                    "achievedGoals": achieved_goals,
                    "achievementRate": achievement_rate,
                    "totalTarget": sum(g["target_amount"] for g in year_goals),
                    "totalProgress": sum(g["progress"] for g in goals_with_progress)
                },
                "generatedAt": datetime.now().isoformat()
            }
        }
    except Exception as e:
        raise HTTPException(500, {"success": False, "message": "Failed to generate goal progress report", "error": str(e)})

@router.get("/report/transaction-details")
async def get_transaction_details_report(month: int = Query(None), year: int = Query(None), user: dict = Depends(authenticate_token)):
    try:
        target_month = month or datetime.now().month
        target_year = year or datetime.now().year
        
        transactions = await Transaction.get_by_month(user["id"], target_month, target_year)
        analytics = calculate_transaction_analytics(transactions)
        
        # Group transactions by date
        transactions_by_date = {}
        for transaction in transactions:
            date = transaction["date"]
            if date not in transactions_by_date:
                transactions_by_date[date] = []
            transactions_by_date[date].append(transaction)
        
        # Sort dates
        sorted_dates = sorted(transactions_by_date.keys(), reverse=True)
        
        # Calculate daily totals
        daily_totals = []
        for date in sorted_dates:
            day_transactions = transactions_by_date[date]
            day_income = sum(t["amount"] for t in day_transactions if t["type"] == "income")
            day_expenses = sum(t["amount"] for t in day_transactions if t["type"] == "expense")
            daily_totals.append({
                "date": date,
                "income": day_income,
                "expenses": day_expenses,
                "net": day_income - day_expenses,
                "transactionCount": len(day_transactions)
            })
        
        return {
            "success": True,
            "data": {
                "period": {
                    "month": target_month,
                    "year": target_year,
                    "monthName": datetime(2000, target_month, 1).strftime("%B")
                },
                "dailyTotals": daily_totals,
                "transactionsByDate": transactions_by_date,
                "summary": analytics["totals"],
                "categoryBreakdown": analytics["categoryBreakdown"],
                "generatedAt": datetime.now().isoformat()
            }
        }
    except Exception as e:
        raise HTTPException(500, {"success": False, "message": "Failed to generate transaction details report", "error": str(e)})

@router.get("/report/financial-health")
async def get_financial_health_report(year: int = Query(None), user: dict = Depends(authenticate_token)):
    try:
        target_year = year or datetime.now().year
        
        all_transactions = await Transaction.get_all(user["id"])
        year_transactions = [t for t in all_transactions if datetime.strptime(t["date"], "%Y-%m-%d").year == target_year]
        
        all_goals = await Goal.get_user_goals(user["id"])
        year_goals = [g for g in all_goals if g["target_year"] == target_year]
        
        yearly_analytics = calculate_yearly_analytics(year_transactions, year_goals)
        monthly_breakdown = calculate_monthly_breakdown(year_transactions, target_year)
        
        # Calculate financial health metrics
        total_income = yearly_analytics["income"]
        total_expenses = yearly_analytics["expenses"]
        net_income = yearly_analytics["net"]
        
        savings_rate = (net_income / total_income * 100) if total_income > 0 else 0
        expense_ratio = (total_expenses / total_income * 100) if total_income > 0 else 0
        
        # Monthly consistency
        monthly_net_incomes = [monthly_breakdown[month]["net"] for month in range(1, 13)]
        positive_months = sum(1 for net in monthly_net_incomes if net > 0)
        consistency_score = (positive_months / 12 * 100) if len(monthly_net_incomes) > 0 else 0
        
        # Goal achievement
        achieved_goals = yearly_analytics.get("achievedGoals", 0)
        total_goals = yearly_analytics.get("totalGoals", 0)
        goal_achievement_rate = yearly_analytics.get("goalsAchievementRate", 0)
        
        # Financial health score (0-100)
        health_score = (
            min(savings_rate, 30) +  # Savings rate contributes up to 30 points
            min(consistency_score, 30) +  # Consistency contributes up to 30 points
            min(goal_achievement_rate, 40)  # Goal achievement contributes up to 40 points
        )
        
        # Health assessment
        if health_score >= 80:
            health_status = "Excellent"
            health_description = "Your financial health is excellent! Keep up the good work."
        elif health_score >= 60:
            health_status = "Good"
            health_description = "Your financial health is good, with room for improvement."
        elif health_score >= 40:
            health_status = "Fair"
            health_description = "Your financial health needs attention in some areas."
        else:
            health_status = "Needs Improvement"
            health_description = "Your financial health requires significant improvement."
        
        return {
            "success": True,
            "data": {
                "period": {
                    "year": target_year,
                    "type": "yearly"
                },
                "healthScore": health_score,
                "healthStatus": health_status,
                "healthDescription": health_description,
                "metrics": {
                    "savingsRate": savings_rate,
                    "expenseRatio": expense_ratio,
                    "consistencyScore": consistency_score,
                    "goalAchievementRate": goal_achievement_rate
                },
                "summary": yearly_analytics,
                "monthlyBreakdown": monthly_breakdown,
                "recommendations": generate_recommendations(health_score, savings_rate, expense_ratio, consistency_score, goal_achievement_rate),
                "generatedAt": datetime.now().isoformat()
            }
        }
    except Exception as e:
        raise HTTPException(500, {"success": False, "message": "Failed to generate financial health report", "error": str(e)})

def generate_recommendations(health_score, savings_rate, expense_ratio, consistency_score, goal_achievement_rate):
    recommendations = []
    
    if savings_rate < 20:
        recommendations.append("Increase your savings rate by reducing discretionary spending")
    
    if expense_ratio > 80:
        recommendations.append("Consider creating a budget to better manage your expenses")
    
    if consistency_score < 50:
        recommendations.append("Work on maintaining consistent positive cash flow each month")
    
    if goal_achievement_rate < 60:
        recommendations.append("Set more realistic financial goals and track progress regularly")
    
    if health_score < 40:
        recommendations.append("Consider consulting with a financial advisor")
    
    if not recommendations:
        recommendations.append("Continue with your current financial strategies")
    
    return recommendations

# PDF Generation Endpoints
@router.get("/report/monthly/pdf")
async def generate_monthly_pdf_report(month: int = Query(None), year: int = Query(None), user: dict = Depends(authenticate_token)):
    try:
        report_data = await generate_report(month, year, user)
        pdf_buffer = generate_monthly_pdf(report_data["data"], user)
        
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=monthly_report_{month or datetime.now().month}_{year or datetime.now().year}.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(500, {"success": False, "message": "Failed to generate PDF report", "error": str(e)})

@router.get("/report/yearly/pdf")
async def generate_yearly_pdf_report(year: int = Query(None), user: dict = Depends(authenticate_token)):
    try:
        report_data = await get_yearly_report(year, user)
        pdf_buffer = generate_yearly_pdf(report_data["data"], user)
        
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=yearly_report_{year or datetime.now().year}.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(500, {"success": False, "message": "Failed to generate PDF report", "error": str(e)})

@router.get("/report/category-breakdown/pdf")
async def generate_category_pdf_report(month: int = Query(None), year: int = Query(None), user: dict = Depends(authenticate_token)):
    try:
        report_data = await get_category_breakdown_report(month, year, user)
        pdf_buffer = generate_category_pdf(report_data["data"], user)
        
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=category_report_{month or datetime.now().month}_{year or datetime.now().year}.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(500, {"success": False, "message": "Failed to generate PDF report", "error": str(e)})

@router.get("/report/goal-progress/pdf")
async def generate_goal_pdf_report(year: int = Query(None), user: dict = Depends(authenticate_token)):
    try:
        report_data = await get_goal_progress_report(year, user)
        pdf_buffer = generate_goal_pdf(report_data["data"], user)
        
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=goal_report_{year or datetime.now().year}.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(500, {"success": False, "message": "Failed to generate PDF report", "error": str(e)})

@router.get("/report/financial-health/pdf")
async def generate_health_pdf_report(year: int = Query(None), user: dict = Depends(authenticate_token)):
    try:
        report_data = await get_financial_health_report(year, user)
        pdf_buffer = generate_health_pdf(report_data["data"], user)
        
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=health_report_{year or datetime.now().year}.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(500, {"success": False, "message": "Failed to generate PDF report", "error": str(e)})

# PDF Generation Functions
def generate_monthly_pdf(data, user):
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
    title = Paragraph(f"Monthly Financial Report - {data['period']['monthName']} {data['period']['year']}", title_style)
    story.append(title)
    
    # Summary Section
    story.append(Paragraph("Financial Summary", styles['Heading2']))
    
    summary_data = [
        ['Metric', 'Amount'],
        ['Total Income', f"${data['summary']['income']:.2f}"],
        ['Total Expenses', f"${data['summary']['expenses']:.2f}"],
        ['Net Income', f"${data['summary']['net']:.2f}"],
        ['Transaction Count', str(data['summary']['transactionCount'])]
    ]
    
    if data['summary'].get('goalStatus'):
        goal_status = data['summary']['goalStatus']
        summary_data.extend([
            ['Monthly Goal', f"${goal_status['target']:.2f}"],
            ['Goal Progress', f"${goal_status['progress']:.2f}"],
            ['Goal Status', 'Achieved' if goal_status['achieved'] else 'In Progress']
        ])
    
    summary_table = Table(summary_data, colWidths=[200, 200])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#6366F1")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#F8FAFC")),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 20))
    
    # Category Breakdown
    story.append(Paragraph("Category Breakdown", styles['Heading2']))
    
    # Income Categories
    if data['analytics']['categoryBreakdown']['income']:
        story.append(Paragraph("Income Categories", styles['Heading3']))
        income_data = [['Category', 'Amount']]
        for category, amount in data['analytics']['categoryBreakdown']['income'].items():
            income_data.append([category, f"${amount:.2f}"])
        
        income_table = Table(income_data, colWidths=[300, 100])
        income_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#10B981")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#D1FAE5")),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(income_table)
        story.append(Spacer(1, 10))
    
    # Expense Categories
    if data['analytics']['categoryBreakdown']['expenses']:
        story.append(Paragraph("Expense Categories", styles['Heading3']))
        expense_data = [['Category', 'Amount']]
        for category, amount in data['analytics']['categoryBreakdown']['expenses'].items():
            expense_data.append([category, f"${amount:.2f}"])
        
        expense_table = Table(expense_data, colWidths=[300, 100])
        expense_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#EF4444")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#FEE2E2")),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(expense_table)
    
    story.append(Spacer(1, 20))
    
    # Footer
    generated_at = datetime.fromisoformat(data['generatedAt']).strftime("%B %d, %Y at %H:%M")
    footer = Paragraph(f"Generated on {generated_at} for {user['name']}", styles['Normal'])
    story.append(footer)
    
    doc.build(story)
    buffer.seek(0)
    return buffer

def generate_yearly_pdf(data, user):
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
    title = Paragraph(f"Yearly Financial Report - {data['period']['year']}", title_style)
    story.append(title)
    
    # Summary Section
    story.append(Paragraph("Annual Summary", styles['Heading2']))
    
    summary_data = [
        ['Metric', 'Amount'],
        ['Total Income', f"${data['summary']['income']:.2f}"],
        ['Total Expenses', f"${data['summary']['expenses']:.2f}"],
        ['Net Savings', f"${data['summary']['net']:.2f}"],
        ['Savings Rate', f"{data['summary']['savingsRate']:.1f}%"],
        ['Goals Achievement', f"{data['summary']['goalsAchievementRate']:.1f}%"],
        ['Total Transactions', str(data['summary']['transactionCount'])]
    ]
    
    summary_table = Table(summary_data, colWidths=[200, 200])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#6366F1")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#F8FAFC")),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 20))
    
    # Monthly Breakdown
    story.append(Paragraph("Monthly Breakdown", styles['Heading2']))
    
    monthly_data = [['Month', 'Income', 'Expenses', 'Net', 'Transactions']]
    for month in range(1, 13):
        if month in data['monthlyBreakdown']:
            month_data = data['monthlyBreakdown'][month]
            monthly_data.append([
                month_data['monthName'],
                f"${month_data['income']:.2f}",
                f"${month_data['expenses']:.2f}",
                f"${month_data['net']:.2f}",
                str(month_data['transactionCount'])
            ])
    
    monthly_table = Table(monthly_data, colWidths=[80, 80, 80, 80, 80])
    monthly_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#6366F1")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#F8FAFC")),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    story.append(monthly_table)
    
    story.append(Spacer(1, 20))
    
    # Footer
    generated_at = datetime.fromisoformat(data['generatedAt']).strftime("%B %d, %Y at %H:%M")
    footer = Paragraph(f"Generated on {generated_at} for {user['name']}", styles['Normal'])
    story.append(footer)
    
    doc.build(story)
    buffer.seek(0)
    return buffer

def generate_category_pdf(data, user):
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
    title = Paragraph(f"Category Breakdown Report - {data['period']['monthName']} {data['period']['year']}", title_style)
    story.append(title)
    
    # Summary
    story.append(Paragraph("Financial Summary", styles['Heading2']))
    summary_data = [
        ['Total Income', f"${data['summary']['totalIncome']:.2f}"],
        ['Total Expenses', f"${data['summary']['totalExpenses']:.2f}"],
        ['Net Income', f"${data['summary']['netIncome']:.2f}"]
    ]
    
    summary_table = Table(summary_data, colWidths=[200, 200])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 20))
    
    # Income Categories
    story.append(Paragraph("Income Categories", styles['Heading2']))
    if data['incomeCategories']:
        income_data = [['Category', 'Amount', 'Percentage']]
        for category in data['incomeCategories']:
            income_data.append([
                category['category'],
                f"${category['amount']:.2f}",
                f"{category['percentage']:.1f}%"
            ])
        
        income_table = Table(income_data, colWidths=[200, 150, 150])
        income_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#10B981")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#D1FAE5")),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(income_table)
    else:
        story.append(Paragraph("No income data available", styles['Normal']))
    
    story.append(Spacer(1, 20))
    
    # Expense Categories
    story.append(Paragraph("Expense Categories", styles['Heading2']))
    if data['expenseCategories']:
        expense_data = [['Category', 'Amount', 'Percentage']]
        for category in data['expenseCategories']:
            expense_data.append([
                category['category'],
                f"${category['amount']:.2f}",
                f"{category['percentage']:.1f}%"
            ])
        
        expense_table = Table(expense_data, colWidths=[200, 150, 150])
        expense_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#EF4444")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#FEE2E2")),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(expense_table)
    else:
        story.append(Paragraph("No expense data available", styles['Normal']))
    
    story.append(Spacer(1, 20))
    
    # Footer
    generated_at = datetime.fromisoformat(data['generatedAt']).strftime("%B %d, %Y at %H:%M")
    footer = Paragraph(f"Generated on {generated_at} for {user['name']}", styles['Normal'])
    story.append(footer)
    
    doc.build(story)
    buffer.seek(0)
    return buffer

def generate_goal_pdf(data, user):
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
    title = Paragraph(f"Goal Progress Report - {data['period']['year']}", title_style)
    story.append(title)
    
    # Summary
    story.append(Paragraph("Goals Summary", styles['Heading2']))
    summary_data = [
        ['Total Goals', str(data['summary']['totalGoals'])],
        ['Achieved Goals', str(data['summary']['achievedGoals'])],
        ['Achievement Rate', f"{data['summary']['achievementRate']:.1f}%"],
        ['Total Target Amount', f"${data['summary']['totalTarget']:.2f}"],
        ['Total Progress', f"${data['summary']['totalProgress']:.2f}"]
    ]
    
    summary_table = Table(summary_data, colWidths=[200, 200])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 20))
    
    # Individual Goals
    story.append(Paragraph("Goal Details", styles['Heading2']))
    if data['goals']:
        goals_data = [['Month', 'Target Amount', 'Progress', 'Status', 'Completion']]
        for goal in data['goals']:
            month_name = datetime(2000, goal['target_month'], 1).strftime("%B")
            status = "Achieved" if goal['achieved'] else "In Progress"
            goals_data.append([
                f"{month_name} {goal['target_year']}",
                f"${goal['target_amount']:.2f}",
                f"${goal['progress']:.2f}",
                status,
                f"{goal['progressPercentage']:.1f}%"
            ])
        
        goals_table = Table(goals_data, colWidths=[120, 100, 100, 100, 80])
        goals_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#6366F1")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#F8FAFC")),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(goals_table)
    else:
        story.append(Paragraph("No goals set for this year", styles['Normal']))
    
    story.append(Spacer(1, 20))
    
    # Footer
    generated_at = datetime.fromisoformat(data['generatedAt']).strftime("%B %d, %Y at %H:%M")
    footer = Paragraph(f"Generated on {generated_at} for {user['name']}", styles['Normal'])
    story.append(footer)
    
    doc.build(story)
    buffer.seek(0)
    return buffer

def generate_health_pdf(data, user):
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
    
    # Health Score
    story.append(Paragraph("Financial Health Assessment", styles['Heading2']))
    
    # Health status with color
    health_color = colors.HexColor("#10B981")  # Green
    if data['healthStatus'] == "Good":
        health_color = colors.HexColor("#3B82F6")  # Blue
    elif data['healthStatus'] == "Fair":
        health_color = colors.HexColor("#F59E0B")  # Yellow
    elif data['healthStatus'] == "Needs Improvement":
        health_color = colors.HexColor("#EF4444")  # Red
    
    health_style = ParagraphStyle(
        'HealthStatus',
        parent=styles['Heading2'],
        textColor=health_color,
        alignment=1
    )
    
    story.append(Paragraph(f"Overall Score: {data['healthScore']:.1f}/100", styles['Heading2']))
    story.append(Paragraph(data['healthStatus'], health_style))
    story.append(Paragraph(data['healthDescription'], styles['Normal']))
    story.append(Spacer(1, 20))
    
    # Metrics
    story.append(Paragraph("Key Metrics", styles['Heading2']))
    metrics_data = [
        ['Metric', 'Value', 'Assessment'],
        ['Savings Rate', f"{data['metrics']['savingsRate']:.1f}%", 'Good' if data['metrics']['savingsRate'] >= 20 else 'Needs Improvement'],
        ['Expense Ratio', f"{data['metrics']['expenseRatio']:.1f}%", 'Good' if data['metrics']['expenseRatio'] <= 80 else 'Needs Improvement'],
        ['Monthly Consistency', f"{data['metrics']['consistencyScore']:.1f}%", 'Good' if data['metrics']['consistencyScore'] >= 50 else 'Needs Improvement'],
        ['Goal Achievement', f"{data['metrics']['goalAchievementRate']:.1f}%", 'Good' if data['metrics']['goalAchievementRate'] >= 60 else 'Needs Improvement']
    ]
    
    metrics_table = Table(metrics_data, colWidths=[150, 100, 150])
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
    story.append(Paragraph("Recommendations", styles['Heading2']))
    for i, recommendation in enumerate(data['recommendations'], 1):
        story.append(Paragraph(f"{i}. {recommendation}", styles['Normal']))
    
    story.append(Spacer(1, 20))
    
    # Financial Summary
    story.append(Paragraph("Financial Summary", styles['Heading2']))
    summary_data = [
        ['Total Income', f"${data['summary']['income']:.2f}"],
        ['Total Expenses', f"${data['summary']['expenses']:.2f}"],
        ['Net Savings', f"${data['summary']['net']:.2f}"],
        ['Goals Achieved', f"{data['summary']['achievedGoals']}/{data['summary']['totalGoals']}"]
    ]
    
    summary_table = Table(summary_data, colWidths=[200, 200])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
    ]))
    story.append(summary_table)
    
    story.append(Spacer(1, 20))
    
    # Footer
    generated_at = datetime.fromisoformat(data['generatedAt']).strftime("%B %d, %Y at %H:%M")
    footer = Paragraph(f"Generated on {generated_at} for {user['name']}", styles['Normal'])
    story.append(footer)
    
    doc.build(story)
    buffer.seek(0)
    return buffer