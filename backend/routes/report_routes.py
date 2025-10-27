from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime
from models.transaction_model import TransactionModel
from models.goal_model import GoalModel
from middleware.auth_middleware import authenticate_token

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("", response_model=dict)
async def generate_report(
    month: int = Query(None, ge=1, le=12),
    year: int = Query(None, ge=2000, le=2100),
    current_user: dict = Depends(authenticate_token)
):
    try:
        target_month = month or datetime.now().month
        target_year = year or datetime.now().year

        # Get transactions for the month
        transactions = await TransactionModel.get_by_month(current_user['id'], target_month, target_year)
        
        # Get goal for the month
        goal = await GoalModel.get_by_user_and_month(current_user['id'], target_month, target_year)

        # Calculate analytics
        analytics = calculate_transaction_analytics(transactions)
        monthly_summary = calculate_monthly_summary(transactions, goal)

        # Generate chart data
        chart_data = generate_chart_data(transactions, target_month, target_year)

        report = {
            "success": True,
            "data": {
                "period": {
                    "month": target_month,
                    "year": target_year,
                    "monthName": get_month_name(target_month)
                },
                "summary": monthly_summary,
                "analytics": analytics,
                "chartData": chart_data,
                "transactions": transactions[:50],  # Limit to 50 transactions
                "generatedAt": datetime.now().isoformat()
            }
        }

        return report
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate report: {str(error)}"
        )

@router.get("/yearly", response_model=dict)
async def get_yearly_report(
    year: int = Query(None, ge=2000, le=2100),
    current_user: dict = Depends(authenticate_token)
):
    try:
        target_year = year or datetime.now().year

        # Get all transactions for the year
        all_transactions = await TransactionModel.get_all(current_user['id'])
        year_transactions = [t for t in all_transactions 
                           if datetime.strptime(str(t['transaction_date']), '%Y-%m-%d').year == target_year]

        # Get all goals for the year
        all_goals = await GoalModel.get_user_goals(current_user['id'])
        year_goals = [g for g in all_goals if g['target_year'] == target_year]

        # Calculate yearly analytics
        yearly_analytics = calculate_yearly_analytics(year_transactions, year_goals)
        monthly_breakdown = calculate_monthly_breakdown(year_transactions, target_year)

        report = {
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

        return report
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate yearly report: {str(error)}"
        )

# Helper functions (same as Express.js version)
def calculate_transaction_analytics(transactions):
    income_transactions = [t for t in transactions if t['type'] == 'income']
    expense_transactions = [t for t in transactions if t['type'] == 'expense']

    total_income = sum(t['amount'] for t in income_transactions)
    total_expenses = sum(t['amount'] for t in expense_transactions)
    net_income = total_income - total_expenses

    # Category breakdown
    income_by_category = group_by_category(income_transactions)
    expenses_by_category = group_by_category(expense_transactions)

    # Top categories
    top_income_categories = sorted(income_by_category.items(), key=lambda x: x[1], reverse=True)[:5]
    top_expense_categories = sorted(expenses_by_category.items(), key=lambda x: x[1], reverse=True)[:5]

    # Average transaction values
    avg_income = total_income / len(income_transactions) if income_transactions else 0
    avg_expense = total_expenses / len(expense_transactions) if expense_transactions else 0

    return {
        "totals": {
            "income": total_income,
            "expenses": total_expenses,
            "net": net_income
        },
        "counts": {
            "income": len(income_transactions),
            "expenses": len(expense_transactions),
            "total": len(transactions)
        },
        "averages": {
            "income": avg_income,
            "expenses": avg_expense
        },
        "topCategories": {
            "income": top_income_categories,
            "expenses": top_expense_categories
        },
        "categoryBreakdown": {
            "income": income_by_category,
            "expenses": expenses_by_category
        }
    }

def calculate_monthly_summary(transactions, goal):
    analytics = calculate_transaction_analytics(transactions)
    
    goal_status = None
    if goal:
        goal_progress = (analytics["totals"]["net"] / goal["target_amount"]) * 100
        goal_status = {
            "target": goal["target_amount"],
            "progress": goal_progress,
            "achieved": analytics["totals"]["net"] >= goal["target_amount"],
            "remaining": max(goal["target_amount"] - analytics["totals"]["net"], 0)
        }

    return {
        **analytics["totals"],
        "goalStatus": goal_status,
        "transactionCount": analytics["counts"]["total"]
    }

def calculate_yearly_analytics(transactions, goals):
    analytics = calculate_transaction_analytics(transactions)
    
    # Calculate savings rate
    savings_rate = (analytics["totals"]["net"] / analytics["totals"]["income"]) * 100 if analytics["totals"]["income"] > 0 else 0

    # Goals achievement rate
    achieved_goals = 0
    for goal in goals:
        month_transactions = [t for t in transactions 
                            if datetime.strptime(str(t['transaction_date']), '%Y-%m-%d').month == goal["target_month"] 
                            and datetime.strptime(str(t['transaction_date']), '%Y-%m-%d').year == goal["target_year"]]
        month_net = calculate_transaction_analytics(month_transactions)["totals"]["net"]
        if month_net >= goal["target_amount"]:
            achieved_goals += 1

    goals_achievement_rate = (achieved_goals / len(goals)) * 100 if goals else 0

    return {
        **analytics["totals"],
        "savingsRate": savings_rate,
        "goalsAchievementRate": goals_achievement_rate,
        "totalGoals": len(goals),
        "achievedGoals": achieved_goals,
        "transactionCount": analytics["counts"]["total"]
    }

def calculate_monthly_breakdown(transactions, year):
    monthly_data = {}
    
    for month in range(1, 13):
        month_transactions = [t for t in transactions 
                            if datetime.strptime(str(t['transaction_date']), '%Y-%m-%d').month == month 
                            and datetime.strptime(str(t['transaction_date']), '%Y-%m-%d').year == year]
        
        analytics = calculate_transaction_analytics(month_transactions)
        
        monthly_data[month] = {
            "month": month,
            "monthName": get_month_name(month),
            **analytics["totals"],
            "transactionCount": analytics["counts"]["total"]
        }
    
    return monthly_data

def group_by_category(transactions):
    result = {}
    for transaction in transactions:
        category = transaction["category"]
        amount = transaction["amount"]
        result[category] = result.get(category, 0) + amount
    return result

def generate_chart_data(transactions, month, year):
    # Daily breakdown for the month
    days_in_month = 31  # Simplified - you might want to calculate actual days
    daily_data = []
    
    for day in range(1, days_in_month + 1):
        day_transactions = [t for t in transactions 
                          if datetime.strptime(str(t['transaction_date']), '%Y-%m-%d').day == day]
        
        day_income = sum(t['amount'] for t in day_transactions if t['type'] == 'income')
        day_expenses = sum(t['amount'] for t in day_transactions if t['type'] == 'expense')
        
        daily_data.append({
            "day": day,
            "income": day_income,
            "expenses": day_expenses,
            "net": day_income - day_expenses
        })

    # Weekly breakdown
    weekly_data = []
    for week in range(5):
        week_start = week * 7 + 1
        week_end = min(week_start + 6, days_in_month)
        
        week_transactions = [t for t in transactions 
                           if week_start <= datetime.strptime(str(t['transaction_date']), '%Y-%m-%d').day <= week_end]
        
        week_income = sum(t['amount'] for t in week_transactions if t['type'] == 'income')
        week_expenses = sum(t['amount'] for t in week_transactions if t['type'] == 'expense')
        
        weekly_data.append({
            "week": week + 1,
            "income": week_income,
            "expenses": week_expenses,
            "net": week_income - week_expenses
        })

    return {
        "daily": daily_data,
        "weekly": weekly_data
    }

def get_month_name(month):
    months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ]
    return months[month - 1] if 1 <= month <= 12 else ''