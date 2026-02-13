# Machine Learning Plan for Surgical Forms App

## ML Opportunities (Ranked by Impact)

### 1. Smart Schedule Optimizer (High Impact, Medium Effort)
- Predict optimal RSA-to-case assignments based on historical data
- Data: personal_schedules, forms (procedures, health centers), physicians
- ML approach: Recommendation system / constraint optimization
- Value: Reduce scheduling conflicts, balance workload, minimize travel

### 2. Surgical Case Volume Forecasting (High Impact, Low Effort)
- Predict how many cases each health center will need per week/month
- Data: forms history (dates, health centers, procedure types)
- ML approach: Time-series forecasting (Prophet, ARIMA, or LSTM)
- Value: Staff RSAs proactively, reduce overtime

### 3. Automated Form Completion (Medium Impact, Low Effort)
- Auto-suggest fields when creating surgical forms
- Data: historical forms
- ML approach: Classification / association rules
- Value: Faster data entry, fewer errors

### 4. Anomaly Detection for Billing/Hours (Medium Impact, Low Effort)
- Flag unusual call hours, duplicate entries, or outlier billing patterns
- Data: call_hours, personal_schedules, hourly_rate
- ML approach: Isolation Forest, statistical anomaly detection
- Value: Catch errors/fraud early, improve payroll accuracy

### 5. RSA Performance Dashboard (Medium Impact, Medium Effort)
- Score RSAs on reliability, case complexity handled, utilization rate
- Data: schedules, forms, attendance patterns
- ML approach: Clustering + scoring metrics
- Value: Data-driven staffing decisions, identify training needs

### Recommended Starting Point
- **Case Volume Forecasting (#2)** — easiest to build, immediate value
- Python, pandas, scikit-learn, Facebook Prophet
- Azure ML Studio or Python API on Azure App Service
- 2-3 weeks for a working prototype

---

## Finance & Revenue ML Opportunities

### With Revenue Data Added:

1. **Revenue Forecasting & Trend Analysis** — Predict monthly/quarterly revenue per health center, physician, or RSA
2. **Profitability per Case / Health Center** — Revenue per case vs. RSA cost (hourly_rate × hours)
3. **Dynamic Pricing / Rate Optimization** — Which case types, times, locations justify higher rates
4. **Revenue Leakage Detection** — Cases worked but not billed, hours without matching forms
5. **RSA ROI Scoring** — Revenue generated per RSA vs. total cost
6. **Client Churn Prediction** — Which health centers might reduce cases or leave

### Finance Table to Add

| Field | Description |
|-------|-------------|
| invoice_id | Unique invoice identifier |
| health_center_id | Link to health center |
| physician_id | Link to physician |
| rsa_user_id | Link to RSA (user) |
| case_date | Date of service |
| procedure_type | Type of surgical case |
| billed_amount | Revenue billed |
| paid_amount | Revenue collected |
| rsa_cost | Cost (hours × rate) |
| payment_status | Pending / Paid / Overdue |
| payment_date | When payment was received |

### Build Plan

| Phase | What | Timeline |
|-------|------|----------|
| Phase 1 | Add finance/invoicing table + CRUD page | 1-2 weeks |
| Phase 2 | Revenue dashboard with charts | 1 week |
| Phase 3 | Revenue forecasting model (Python) | 2-3 weeks |
| Phase 4 | Profitability analysis & anomaly detection | 2-3 weeks |

### Tech Stack
- Python for all ML work
- Azure Machine Learning for training/deploying models
- Power BI or React dashboard for visualizations
- PostgreSQL (existing DB) as data source
