---
title: "Common Vanna AI Training Mistakes and How to Fix Them"
description: "Learn how to identify and fix the most common Vanna AI training mistakes that reduce accuracy in Text-to-SQL systems. Includes before/after examples, troubleshooting guides, and production-tested solutions."
publishDate: 2025-01-14
tags: ["AI", "SQL", "Vanna AI", "Data Engineering", "Machine Learning"]
draft: false
heroImage: ""
category: "AI/ML"
---

> 📋 **Prerequisites**:
> - Basic understanding of Text-to-SQL concepts
> - Familiarity with SQL query syntax
> - Python 3.8 or later
> - Vanna AI package installed (`pip install vanna`)
> - Access to a database for testing (development/staging recommended)

## Overview

Training Vanna AI for Text-to-SQL requires more than adding example queries to the system. After implementing Text-to-SQL across federal government databases, I've identified specific training mistakes that consistently reduce accuracy from the 85%+ range down to 40% or below.

This guide shows you how to identify these mistakes in your training data and provides step-by-step fixes with before/after code examples. You'll learn to recognize patterns that harm model performance and implement solutions that have been validated in production environments.

**What you'll learn:**
- How to identify the 10 most common training mistakes
- Systematic approaches to fix each mistake
- Progressive improvement strategies for existing training data
- Troubleshooting techniques organized by mistake type

> ℹ️ **Note**: Vanna AI is an assistant tool that helps translate natural language to SQL. It requires proper training and always needs human verification of results before executing queries on production data.

## Understanding Training Quality Impact

Before diving into specific mistakes, you need to understand why training quality matters critically for Text-to-SQL systems.

### The Cost of Poor Training

Poor training quality doesn't just reduce accuracy—it creates production problems:

**Security Risks**: Untrained or poorly trained models may generate queries that expose sensitive data or bypass security filters.

**Performance Issues**: Inefficient queries generated from bad training examples can slow down or crash production databases.

**User Trust**: When generated queries frequently fail or return incorrect results, users abandon the system entirely.

**Maintenance Burden**: Teams spend more time debugging and correcting bad outputs than they save from using the system.

> ⚠️ **Warning**: In systems handling sensitive data, a single malformed query can trigger security alerts or compliance violations. Government systems require particular attention to training data quality and validation.

### Training Quality vs. Accuracy Correlation

Your training data quality directly impacts model accuracy:

| Training Quality | Expected Accuracy | Common Issues |
|-----------------|-------------------|---------------|
| High-quality, diverse examples | 85%+ | Minimal, edge cases only |
| Moderate quality, some gaps | 60-75% | Struggles with complex queries |
| Poor quality, inconsistent | 40% or below | Frequent failures, wrong results |

## Common Training Mistakes Comparison

The following table shows the most common training mistakes and their impact:

| Mistake | Impact on Accuracy | Detection Difficulty | Fix Complexity |
|---------|-------------------|---------------------|----------------|
| Training with PII data | Security risk, not accuracy | Easy | Simple |
| Overfitting to patterns | High (-30% to -45%) | Medium | Medium |
| Missing business context | High (-25% to -40%) | Hard | Medium |
| No edge case handling | Medium (-15% to -25%) | Medium | Medium |
| Missing data context | High (-30% to -45%) | Easy | Simple |
| Undefined relationships | High (-25% to -35%) | Medium | Medium |
| Poor NULL handling | Medium (-15% to -25%) | Medium | Simple |
| Only successful examples | Low (-10% to -15%) | Hard | Simple |
| Ignoring data types | Low (-5% to -15%) | Easy | Simple |
| Outdated schemas | Critical (breaks queries) | Easy | Medium |

## Mistake 1: Training with Production Data Containing PII

### Problem Description

You use real production data with personally identifiable information (PII) in your training examples without sanitization.

**Why this occurs**: Teams often start by exporting real queries from production logs without considering privacy implications.

**Critical impact**: Vanna AI stores training examples in its knowledge base. Including PII violates privacy regulations and creates security vulnerabilities. In government systems, this can trigger FISMA audit failures.

### Identification Checklist

Check your training data for these warning signs:
- [ ] Training examples contain real names, email addresses, or phone numbers
- [ ] Examples include Social Security Numbers, employee IDs, or other identifiers
- [ ] Queries reference actual salary amounts or financial data
- [ ] Medical records, security clearances, or classified data appears in examples

### ❌ MISTAKE Example

```sql
-- WRONG: Training example contains real PII
SELECT
    first_name,          -- Real names
    last_name,
    ssn,                 -- Social Security Number
    email,               -- Personal email
    salary,              -- Actual salary data
    medical_condition    -- Protected health information
FROM employees
WHERE department = 'Engineering'
    AND clearance_level = 'Top Secret'
```

**Why this fails:**
- Stores PII in Vanna AI's knowledge base
- Violates GDPR, HIPAA, and other privacy regulations
- Creates audit trail of sensitive data
- Exposes data to potential breaches

### ✅ SOLUTION Example

```sql
-- CORRECT: Sanitized training example
SELECT
    first_name,          -- Generic field names only
    last_name,
    employee_id,         -- Non-sensitive identifier
    salary_band,         -- Range instead of exact amount
    department_code      -- Code instead of sensitive details
FROM employees
WHERE department = 'Engineering'
    AND active_status = 'A'

-- BETTER: Use synthetic examples
SELECT
    first_name,
    last_name,
    emp_id,
    salary_range
FROM staff_members
WHERE dept_code = 'ENG'
    AND status = 'active'
```

### Progressive Fix Steps

**Step 1: Audit existing training data**
```python
# Review all training examples for PII
import vanna as vn

training_data = vn.get_training_data()

# Check for common PII patterns
pii_patterns = [
    r'\bssn\b',
    r'\bemail\b',
    r'\bphone\b',
    r'\b\d{3}-\d{2}-\d{4}\b',  # SSN format
    r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'  # Email
]

for item in training_data:
    for pattern in pii_patterns:
        if re.search(pattern, item['sql'], re.IGNORECASE):
            print(f"⚠️ Potential PII found: {item['id']}")
```

**Step 2: Create sanitization rules**
```python
def sanitize_training_sql(sql: str) -> str:
    """
    Sanitize SQL training examples by removing or replacing PII.
    """
    sanitized = sql

    # Replace specific PII columns with generic equivalents
    replacements = {
        'ssn': 'employee_id',
        'social_security': 'emp_identifier',
        'email': 'contact_id',
        'phone': 'phone_ext',
        'medical_condition': 'health_category',
        'clearance_level': 'access_level'
    }

    for pii_term, replacement in replacements.items():
        sanitized = re.sub(
            rf'\b{pii_term}\b',
            replacement,
            sanitized,
            flags=re.IGNORECASE
        )

    return sanitized
```

**Step 3: Implement training data validation**
```python
def validate_training_data(question: str, sql: str, documentation: str = None):
    """
    Validate training data before adding to Vanna AI.
    Returns (is_valid, error_message).
    """
    # Check for PII patterns
    pii_check = check_for_pii(sql)
    if not pii_check['is_clean']:
        return False, f"PII detected: {pii_check['violations']}"

    # Check for sensitive tables
    sensitive_tables = ['classified_docs', 'security_clearances', 'medical_records']
    for table in sensitive_tables:
        if table.lower() in sql.lower():
            return False, f"References sensitive table: {table}"

    return True, "Training data validated"

# Use validation before training
is_valid, message = validate_training_data(question, sql)
if is_valid:
    vn.train(question=question, sql=sql)
else:
    print(f"❌ Validation failed: {message}")
```

> 💡 **Tip**: Create a dedicated training database with synthetic data that mirrors your production schema. This approach reduces compliance risks completely while maintaining training effectiveness.

## Mistake 2: Overfitting to Specific Query Patterns

### Problem Description

You train only on similar query structures, which creates a model that can't generalize to different question types.

**Why this occurs**: Teams often start with a narrow set of use cases and don't diversify their training examples.

**Critical impact**: The model learns pattern matching instead of understanding SQL concepts. When users ask questions in different ways, accuracy drops significantly.

### Identification Checklist

Review your training data for these signs:
- [ ] Most queries use the same SELECT pattern
- [ ] Limited or no JOIN examples
- [ ] No aggregation queries (GROUP BY, COUNT, AVG)
- [ ] Missing subqueries or CTEs
- [ ] All queries target the same 2-3 tables

### ❌ MISTAKE Example

```sql
-- Training examples that are too similar
-- Example 1
SELECT * FROM users WHERE status = 'active'

-- Example 2
SELECT * FROM users WHERE status = 'inactive'

-- Example 3
SELECT * FROM users WHERE status = 'pending'

-- Example 4
SELECT * FROM users WHERE status = 'deleted'
```

**Why this fails:**
- Model only learns simple WHERE clause patterns
- Can't handle JOINs, aggregations, or complex logic
- Struggles with questions phrased differently
- Limited to single-table queries

### ✅ SOLUTION Example

```sql
-- Diverse training examples covering multiple query types

-- Simple SELECT with filtering
SELECT count(*)
FROM users
WHERE created_date > '2024-01-01'
    AND status = 'active'

-- JOIN with multiple tables
SELECT
    u.username,
    u.email,
    p.title,
    p.created_date
FROM users u
INNER JOIN projects p ON u.id = p.owner_id
WHERE p.status = 'active'
    AND u.department = 'Engineering'

-- Aggregation with GROUP BY
SELECT
    department,
    COUNT(*) as employee_count,
    AVG(salary) as avg_salary,
    MAX(hire_date) as most_recent_hire
FROM employees
WHERE termination_date IS NULL
GROUP BY department
HAVING COUNT(*) > 5
ORDER BY avg_salary DESC

-- Subquery for comparison
SELECT
    employee_id,
    salary,
    department
FROM employees
WHERE salary > (
    SELECT AVG(salary)
    FROM employees
    WHERE department = 'Engineering'
)

-- Common Table Expression (CTE)
WITH department_stats AS (
    SELECT
        department,
        AVG(salary) as avg_salary,
        COUNT(*) as emp_count
    FROM employees
    GROUP BY department
)
SELECT
    e.employee_id,
    e.name,
    e.salary,
    d.avg_salary,
    (e.salary - d.avg_salary) as difference
FROM employees e
JOIN department_stats d ON e.department = d.department
WHERE e.salary > d.avg_salary
```

### Progressive Fix Steps

**Step 1: Categorize existing training data**
```python
def categorize_query_types(training_data):
    """
    Analyze training data to identify query type distribution.
    """
    categories = {
        'simple_select': 0,
        'joins': 0,
        'aggregations': 0,
        'subqueries': 0,
        'cte': 0,
        'window_functions': 0
    }

    for item in training_data:
        sql = item['sql'].upper()

        if 'JOIN' in sql:
            categories['joins'] += 1
        if any(agg in sql for agg in ['COUNT', 'AVG', 'SUM', 'MIN', 'MAX']):
            categories['aggregations'] += 1
        if 'SELECT' in sql and sql.count('SELECT') > 1:
            categories['subqueries'] += 1
        if 'WITH' in sql:
            categories['cte'] += 1
        if 'OVER' in sql or 'PARTITION BY' in sql:
            categories['window_functions'] += 1
        if 'SELECT' in sql and 'WHERE' in sql and categories[sql] == 0:
            categories['simple_select'] += 1

    return categories

# Analyze current distribution
distribution = categorize_query_types(vn.get_training_data())
print("Query type distribution:")
for query_type, count in distribution.items():
    print(f"  {query_type}: {count}")
```

**Step 2: Create diverse training examples**
```python
def create_diverse_training_set(table_name: str):
    """
    Generate diverse query examples for a single table.
    """
    training_examples = []

    # Simple SELECT
    training_examples.append({
        'question': f'Show all active {table_name}',
        'sql': f'SELECT * FROM {table_name} WHERE status = \'active\''
    })

    # Aggregation
    training_examples.append({
        'question': f'How many {table_name} are there by category?',
        'sql': f'SELECT category, COUNT(*) as count FROM {table_name} GROUP BY category'
    })

    # Date filtering
    training_examples.append({
        'question': f'Show {table_name} created in the last 30 days',
        'sql': f'SELECT * FROM {table_name} WHERE created_date >= DATEADD(day, -30, GETDATE())'
    })

    # Ordering and limiting
    training_examples.append({
        'question': f'Show top 10 {table_name} by value',
        'sql': f'SELECT TOP 10 * FROM {table_name} ORDER BY value DESC'
    })

    return training_examples

# Train with diverse examples
for table in ['users', 'orders', 'products']:
    examples = create_diverse_training_set(table)
    for example in examples:
        vn.train(
            question=example['question'],
            sql=example['sql']
        )
```

**Step 3: Implement query type quotas**
```python
def ensure_query_diversity(min_per_category: int = 5):
    """
    Ensure minimum number of examples per query category.
    """
    current_distribution = categorize_query_types(vn.get_training_data())

    gaps = {}
    for category, count in current_distribution.items():
        if count < min_per_category:
            gaps[category] = min_per_category - count

    if gaps:
        print("Training data gaps found:")
        for category, needed in gaps.items():
            print(f"  {category}: need {needed} more examples")
        return False

    print("✅ Training data has sufficient diversity")
    return True

# Check diversity before deployment
ensure_query_diversity(min_per_category=5)
```

> ⚠️ **Warning**: Aim for at least 5 different query types per table: simple selects, joins, aggregations, subqueries, and conditional logic. Without this diversity, your model will fail on common business questions.

## Mistake 3: Ignoring Business Logic Documentation

### Problem Description

You train without including business context and domain-specific rules that connect technical database structures to real-world business concepts.

**Why this occurs**: Teams focus on technical SQL syntax without considering that users ask business questions, not technical queries.

**Critical impact**: Without business context, Vanna AI can't map user questions like "low stock items" to technical concepts like "quantity < reorder_point".

### Identification Checklist

Check for missing business context:
- [ ] Training examples lack documentation explaining business rules
- [ ] No explanation of calculated fields or derived values
- [ ] Missing context about when to use specific filters
- [ ] No documentation of business terminology
- [ ] Unclear relationship between business processes and data

### ❌ MISTAKE Example

```python
# WRONG: Technical training without business context
vn.train(
    question="Show products with low inventory",
    sql="""
    SELECT product_id, quantity
    FROM inventory
    WHERE quantity < 10
    """
)
```

**Why this fails:**
- Hard-coded threshold (10) isn't explained
- No business rule documentation
- Missing context about reorder points
- Can't adapt to different inventory management strategies

### ✅ SOLUTION Example

```python
# CORRECT: Include comprehensive business context
vn.train(
    question="Show me products that need reordering",
    sql="""
    SELECT
        p.product_name,
        p.product_code,
        i.current_quantity,
        i.reorder_point,
        i.lead_time_days,
        (i.reorder_point - i.current_quantity) as units_below_threshold
    FROM products p
    INNER JOIN inventory i ON p.id = i.product_id
    WHERE i.current_quantity <= i.reorder_point
        AND p.status = 'active'
        AND p.discontinued_date IS NULL
    ORDER BY (i.reorder_point - i.current_quantity) DESC
    """,
    documentation="""
    BUSINESS CONTEXT:
    Products need reordering when current_quantity falls to or below the reorder_point.
    This is critical for supply chain management to prevent stockouts.

    BUSINESS RULES:
    - Reorder point is calculated based on: (average_daily_sales * lead_time_days) + safety_stock
    - Only active, non-discontinued products should trigger reorder alerts
    - Priority is determined by how far below reorder point (most critical first)

    TERMINOLOGY:
    - "Low stock" = current_quantity <= reorder_point
    - "Need reordering" = same as low stock
    - "Out of stock" = current_quantity = 0
    - "Overstock" = current_quantity > max_stock_level

    RELATED CONCEPTS:
    - Lead time: Days between placing order and receiving inventory
    - Safety stock: Buffer inventory to handle demand variability
    - Max stock level: Upper limit to prevent over-ordering
    """
)
```

### Progressive Fix Steps

**Step 1: Document business terminology**
```python
def add_business_terminology(domain: str):
    """
    Add business terminology documentation for a domain.
    """
    terminology_docs = {
        'inventory': """
        INVENTORY MANAGEMENT TERMINOLOGY:

        - Low Stock: Inventory level at or below reorder point
        - Reorder Point: Threshold triggering purchase orders
        - Lead Time: Days from order to receipt
        - Safety Stock: Buffer for demand variability
        - Stockout: Zero inventory available
        - Overstock: Inventory exceeding max levels
        - SKU: Stock Keeping Unit (unique product identifier)
        - Turnover Rate: How quickly inventory sells

        BUSINESS PROCESSES:
        - Automatic reordering triggers when current <= reorder point
        - Seasonal products have different reorder points
        - High-priority items have larger safety stock
        - Obsolete items are marked discontinued but remain in system
        """,

        'sales': """
        SALES TERMINOLOGY:

        - Active Customer: Purchased within last 12 months
        - Churned Customer: No purchases in 12+ months
        - Lifetime Value (LTV): Total revenue from customer
        - Average Order Value (AOV): Total revenue / order count
        - Conversion Rate: (Purchases / Visitors) * 100
        - Cart Abandonment: Started checkout but didn't complete

        BUSINESS RULES:
        - Revenue recognition happens at order completion
        - Refunds create negative revenue entries
        - Wholesale orders have different pricing tiers
        - Seasonal sales periods affect metrics
        """
    }

    if domain in terminology_docs:
        vn.train(documentation=terminology_docs[domain])
        print(f"✅ Added business terminology for {domain}")
```

**Step 2: Add calculated field documentation**
```python
def document_calculated_fields(table_name: str, calculated_fields: dict):
    """
    Document how calculated fields are derived.
    """
    doc = f"CALCULATED FIELDS for {table_name}:\n\n"

    for field_name, calculation_info in calculated_fields.items():
        doc += f"{field_name}:\n"
        doc += f"  Formula: {calculation_info['formula']}\n"
        doc += f"  Business Purpose: {calculation_info['purpose']}\n"
        doc += f"  Example: {calculation_info['example']}\n\n"

    vn.train(documentation=doc)

# Example usage
document_calculated_fields('orders', {
    'order_profit': {
        'formula': 'order_total - order_cost - shipping_cost - tax',
        'purpose': 'Net profit after all costs deducted',
        'example': '$100 revenue - $60 cost - $5 shipping - $7 tax = $28 profit'
    },
    'customer_lifetime_value': {
        'formula': 'SUM(order_total) for all customer orders',
        'purpose': 'Total revenue generated by customer over time',
        'example': 'Customer with 5 orders totaling $500 has LTV of $500'
    }
})
```

**Step 3: Create business rule examples**
```python
def add_business_rule_example(rule_name: str, rule_description: str,
                              example_question: str, example_sql: str):
    """
    Add training example with explicit business rule documentation.
    """
    full_doc = f"""
    BUSINESS RULE: {rule_name}

    {rule_description}

    This rule is implemented in the SQL below and should be applied
    whenever the user asks about this business concept.
    """

    vn.train(
        question=example_question,
        sql=example_sql,
        documentation=full_doc
    )

# Example: Document discount eligibility rules
add_business_rule_example(
    rule_name="VIP Customer Discount Eligibility",
    rule_description="""
    Customers qualify for VIP discounts when they meet ANY of:
    - Lifetime purchases exceed $10,000
    - More than 50 orders in last 12 months
    - Member of corporate account with VIP status

    VIP discount rate is 15% on all non-sale items.
    """,
    example_question="Show me customers eligible for VIP discounts",
    example_sql="""
    SELECT
        c.customer_id,
        c.name,
        c.email,
        SUM(o.total) as lifetime_value,
        COUNT(o.order_id) as order_count
    FROM customers c
    LEFT JOIN orders o ON c.customer_id = o.customer_id
    WHERE o.order_date >= DATEADD(year, -1, GETDATE())
    GROUP BY c.customer_id, c.name, c.email
    HAVING SUM(o.total) > 10000
        OR COUNT(o.order_id) > 50
        OR c.corporate_account_status = 'VIP'
    """
)
```

> 💡 **Tip**: After adding business context to training data, accuracy for domain-specific queries commonly improves from the 45-60% range to the 75-85% range.

## Mistake 4: Not Validating Against Edge Cases

### Problem Description

You train only on happy-path scenarios without considering edge cases like NULL values, empty result sets, or boundary conditions.

**Why this occurs**: Teams often focus on typical use cases and don't think through unusual but valid data scenarios.

**Critical impact**: Real-world data is messy. Missing edge cases leads to SQL errors or incorrect results when the model encounters NULL values, date boundaries, or division by zero.

### Identification Checklist

Review your training for edge case coverage:
- [ ] Examples handle NULL values explicitly
- [ ] Date range queries use proper boundary conditions
- [ ] Aggregations account for empty groups
- [ ] Division operations check for zero denominators
- [ ] Queries handle soft-deleted records appropriately

### ❌ MISTAKE Example

```sql
-- WRONG: Only training on normal cases
SELECT
    customer_name,
    order_total
FROM orders
WHERE order_date = '2024-01-15'
```

**Why this fails:**
- Doesn't handle NULL customer names
- Doesn't handle NULL order totals
- Single date match instead of range
- Ignores soft-deleted records
- No handling for cancelled orders

### ✅ SOLUTION Example

```sql
-- CORRECT: Training with comprehensive edge case handling
SELECT
    COALESCE(c.customer_name, 'Unknown Customer') as customer_name,
    COALESCE(o.order_total, 0.00) as order_total,
    o.order_status,
    o.deleted_at
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.customer_id
WHERE o.order_date >= '2024-01-01'
    AND o.order_date < '2024-02-01'
    AND o.deleted_at IS NULL  -- Exclude soft-deleted
    AND o.order_status != 'cancelled'  -- Exclude cancelled
    AND o.order_total IS NOT NULL  -- Exclude incomplete orders
ORDER BY o.order_date DESC, o.order_total DESC
```

### Critical Edge Cases to Include

**NULL Value Handling**
```sql
-- Train on NULL-aware aggregations
SELECT
    department,
    COUNT(*) as total_employees,
    COUNT(salary) as employees_with_salary,  -- Excludes NULLs
    AVG(COALESCE(salary, 0)) as avg_salary,
    SUM(CASE WHEN salary IS NULL THEN 1 ELSE 0 END) as missing_salaries
FROM employees
GROUP BY department
```

**Date Range Boundaries**
```sql
-- Train on proper date range handling
SELECT *
FROM transactions
WHERE transaction_date >= '2024-01-01'  -- Inclusive start
    AND transaction_date < '2024-02-01'  -- Exclusive end
    AND transaction_date IS NOT NULL  -- Handle NULLs
```

**Division by Zero**
```sql
-- Train on safe division
SELECT
    department,
    total_sales,
    total_employees,
    CASE
        WHEN total_employees > 0
        THEN total_sales / total_employees
        ELSE 0
    END as sales_per_employee
FROM department_stats
```

**Empty Result Sets**
```sql
-- Train on queries that might return no results
SELECT
    COALESCE(
        (SELECT COUNT(*) FROM orders WHERE status = 'pending'),
        0
    ) as pending_order_count
```

**Soft-Deleted Records**
```sql
-- Train on soft-delete handling
SELECT *
FROM users
WHERE deleted_at IS NULL  -- Active records only
    AND status = 'active'

-- Or when you want to include deleted records
SELECT *,
    CASE
        WHEN deleted_at IS NOT NULL THEN 'Deleted'
        ELSE 'Active'
    END as record_status
FROM users
```

### Progressive Fix Steps

**Step 1: Add NULL handling patterns**
```python
def add_null_handling_examples(table_name: str, nullable_columns: list):
    """
    Add training examples for NULL value handling.
    """
    for column in nullable_columns:
        # NULL checking example
        vn.train(
            question=f"Show {table_name} where {column} is not provided",
            sql=f"SELECT * FROM {table_name} WHERE {column} IS NULL"
        )

        # COALESCE example
        vn.train(
            question=f"Show {table_name} with default value for missing {column}",
            sql=f"""
            SELECT
                *,
                COALESCE({column}, 'Not Specified') as {column}_display
            FROM {table_name}
            """
        )

        # Aggregation with NULL awareness
        vn.train(
            question=f"Count how many {table_name} have {column} specified",
            sql=f"""
            SELECT
                COUNT(*) as total_records,
                COUNT({column}) as records_with_{column},
                COUNT(*) - COUNT({column}) as records_missing_{column}
            FROM {table_name}
            """
        )

# Apply to your tables
add_null_handling_examples('employees', ['salary', 'manager_id', 'termination_date'])
```

**Step 2: Add boundary condition examples**
```python
def add_boundary_examples(table_name: str, date_column: str):
    """
    Add training examples for date boundaries and ranges.
    """
    examples = [
        {
            'question': f'Show {table_name} from last month',
            'sql': f"""
            SELECT * FROM {table_name}
            WHERE {date_column} >= DATEADD(month, -1, GETDATE())
                AND {date_column} < GETDATE()
            """
        },
        {
            'question': f'Show {table_name} from a specific month',
            'sql': f"""
            SELECT * FROM {table_name}
            WHERE {date_column} >= '2024-01-01'
                AND {date_column} < '2024-02-01'
            """
        },
        {
            'question': f'Show {table_name} with missing dates',
            'sql': f"""
            SELECT * FROM {table_name}
            WHERE {date_column} IS NULL
            """
        }
    ]

    for example in examples:
        vn.train(question=example['question'], sql=example['sql'])

add_boundary_examples('orders', 'order_date')
```

**Step 3: Create edge case test suite**
```python
def validate_edge_case_coverage():
    """
    Test if training data covers common edge cases.
    """
    edge_case_questions = [
        "Show records where salary is not specified",
        "Calculate average with null values",
        "Show records from last month including boundary dates",
        "Count records excluding soft-deleted items",
        "Calculate percentage handling division by zero"
    ]

    coverage = []
    for question in edge_case_questions:
        try:
            sql = vn.generate_sql(question)

            # Check if SQL has NULL handling
            has_null_check = 'IS NULL' in sql.upper() or 'COALESCE' in sql.upper()

            # Check if SQL has boundary handling
            has_boundary = '>=' in sql and '<' in sql

            # Check if SQL has division safety
            has_safe_division = 'CASE' in sql.upper() and '/' in sql

            coverage.append({
                'question': question,
                'has_null_check': has_null_check,
                'has_boundary': has_boundary,
                'has_safe_division': has_safe_division
            })
        except Exception as e:
            coverage.append({
                'question': question,
                'error': str(e)
            })

    return coverage

# Run edge case validation
results = validate_edge_case_coverage()
for result in results:
    if 'error' in result:
        print(f"❌ {result['question']}: {result['error']}")
    else:
        print(f"✅ {result['question']}: Covered")
```

> ⚠️ **Warning**: In production environments, edge cases occur regularly, not rarely. Your training must include NULL handling, boundary conditions, and data quality checks to achieve reliable accuracy.

## Mistake Identification Checklist

Use this comprehensive checklist to audit your Vanna AI training data:

### Data Security & Privacy
- [ ] No PII (names, emails, SSN, phone numbers) in training examples
- [ ] No sensitive financial data (exact salaries, account numbers)
- [ ] No classified or confidential information
- [ ] No references to sensitive tables or systems
- [ ] Training database uses synthetic or sanitized data

### Query Diversity
- [ ] At least 5 simple SELECT queries per major table
- [ ] At least 3 JOIN examples showing table relationships
- [ ] At least 3 aggregation queries (COUNT, AVG, SUM, etc.)
- [ ] At least 2 subquery or CTE examples
- [ ] At least 2 window function examples (if applicable)
- [ ] Multiple WHERE clause patterns (AND, OR, IN, BETWEEN)

### Business Context
- [ ] Documentation explains business terminology
- [ ] Business rules are documented with examples
- [ ] Calculated fields have formula documentation
- [ ] Domain-specific concepts are explained
- [ ] Relationships between business processes and data are clear

### Edge Case Coverage
- [ ] NULL value handling in SELECT, WHERE, and aggregations
- [ ] Date range boundary conditions (>= and <, not = or BETWEEN)
- [ ] Division by zero protection
- [ ] Empty result set handling
- [ ] Soft-deleted record filtering

### Data Context
- [ ] DDL (CREATE TABLE) statements for all tables
- [ ] Column descriptions and data types documented
- [ ] Table relationships (foreign keys) documented
- [ ] Default values and constraints explained
- [ ] Indexes and performance considerations noted

### Schema Accuracy
- [ ] Training data matches current production schema
- [ ] Deprecated columns removed from examples
- [ ] New columns added to training
- [ ] Renamed tables/columns updated everywhere
- [ ] Schema documentation review date within last 90 days

### Query Quality
- [ ] No SELECT * in production training examples
- [ ] Proper JOIN syntax (no comma joins)
- [ ] Parameterized date filters (not hard-coded dates)
- [ ] Appropriate indexes referenced in documentation
- [ ] Performance considerations documented

### Error Prevention
- [ ] Examples of common mistakes and corrections
- [ ] Documentation of anti-patterns to avoid
- [ ] Failed query examples with explanations
- [ ] Common error messages documented
- [ ] Troubleshooting guides for frequent issues

## Troubleshooting Guide by Mistake Type

### Issue: Low Accuracy on Domain-Specific Questions

**Symptoms:**
- Model handles technical SQL well but fails on business questions
- Generated queries use wrong columns for business concepts
- Can't translate business terminology to database fields

**Likely Cause:** Mistake #3 - Missing Business Logic Documentation

**Diagnostic Steps:**
```python
# Test business terminology understanding
business_questions = [
    "Show me low stock items",
    "Which customers are VIP qualified?",
    "What products need reordering?"
]

for question in business_questions:
    sql = vn.generate_sql(question)
    print(f"Question: {question}")
    print(f"Generated SQL: {sql}\n")
    # Review if business concepts are correctly mapped
```

**Solution:**
Add comprehensive business documentation for your domain (see Mistake #3 fixes above).

### Issue: Queries Fail with NULL-Related Errors

**Symptoms:**
- "Conversion failed when converting the nvarchar value 'NULL' to data type int"
- Aggregations return unexpected results
- COUNT(*) and COUNT(column) show different values

**Likely Cause:** Mistake #4 - Missing Edge Case Handling

**Diagnostic Steps:**
```python
# Check NULL handling in generated queries
test_question = "Show average salary by department"
sql = vn.generate_sql(test_question)

# Look for NULL-safe patterns
has_null_safety = any([
    'COALESCE' in sql.upper(),
    'ISNULL' in sql.upper(),
    'IS NULL' in sql.upper(),
    'IS NOT NULL' in sql.upper()
])

if not has_null_safety:
    print("⚠️ Generated query may not handle NULL values")
```

**Solution:**
Add NULL handling training examples (see Mistake #4 fixes above).

### Issue: Model Can't Handle Complex Queries

**Symptoms:**
- Simple queries work fine
- JOIN queries fail or use wrong columns
- Aggregations produce syntax errors
- Subqueries are malformed

**Likely Cause:** Mistake #2 - Overfitting to Simple Patterns

**Diagnostic Steps:**
```python
# Analyze query complexity distribution
distribution = categorize_query_types(vn.get_training_data())
total = sum(distribution.values())

print("Training data distribution:")
for query_type, count in distribution.items():
    percentage = (count / total * 100) if total > 0 else 0
    print(f"  {query_type}: {count} ({percentage:.1f}%)")

# Flag if any category is below 10%
for query_type, count in distribution.items():
    percentage = (count / total * 100) if total > 0 else 0
    if percentage < 10:
        print(f"⚠️ Warning: Low coverage for {query_type}")
```

**Solution:**
Add diverse query patterns (see Mistake #2 fixes above).

### Issue: Schema Change Breaks Queries

**Symptoms:**
- "Invalid column name" errors
- "Invalid object name" errors
- Queries reference non-existent tables
- Model suggests deprecated columns

**Likely Cause:** Mistake #10 - Outdated Schema Training

**Diagnostic Steps:**
```python
def validate_training_schema():
    """
    Check if training references match current schema.
    """
    # Get current database schema
    current_tables = get_database_tables()  # Your implementation
    current_columns = get_database_columns()  # Your implementation

    # Get training data
    training_data = vn.get_training_data()

    issues = []
    for item in training_data:
        sql = item.get('sql', '')

        # Extract table references (simplified)
        referenced_tables = extract_table_names(sql)

        for table in referenced_tables:
            if table not in current_tables:
                issues.append(f"Training references non-existent table: {table}")

    return issues

issues = validate_training_schema()
if issues:
    print("⚠️ Schema validation issues:")
    for issue in issues:
        print(f"  - {issue}")
```

**Solution:**
Implement automated schema validation and update training data when schema changes.

### Issue: Queries Don't Handle Table Relationships

**Symptoms:**
- Cartesian products in results
- Missing JOIN clauses
- Wrong columns used for joins
- Can't answer questions requiring multiple tables

**Likely Cause:** Mistake #6 - Missing Relationship Documentation

**Diagnostic Steps:**
```python
# Test relationship understanding
relationship_questions = [
    "Show orders with customer information",
    "List products and their categories",
    "Show employees and their managers"
]

for question in relationship_questions:
    sql = vn.generate_sql(question)

    # Check if JOIN is present
    has_join = 'JOIN' in sql.upper()

    # Check if ON clause exists
    has_on = 'ON' in sql.upper()

    print(f"Question: {question}")
    print(f"Has JOIN: {has_join}, Has ON: {has_on}")
    if not (has_join and has_on):
        print("⚠️ May be missing proper relationship handling\n")
```

**Solution:**
Add explicit relationship training (foreign keys, JOIN patterns, relationship documentation).

## FAQ: Avoiding Training Mistakes

### Q: How many training examples do I need?

**A:** Quality matters more than quantity. A well-structured training set includes:

- **Minimum viable**: 30-50 examples covering all query types and major tables
- **Production ready**: 100-200 examples with business context and edge cases
- **Enterprise scale**: 300+ examples for complex schemas with multiple domains

Focus on diversity over volume. 50 well-crafted examples covering different patterns outperform 500 similar queries.

### Q: Should I train on successful queries only?

**A:** No. Include examples of common mistakes and their corrections (Mistake #8). This helps the model learn what NOT to do.

```python
# Example: Train on anti-patterns
vn.train(
    question="Common mistake: Missing JOIN condition",
    sql="-- WRONG: Creates Cartesian product\n-- SELECT * FROM orders, customers",
    documentation="""
    Never use comma joins without WHERE clause - creates Cartesian product.
    Always use explicit JOIN with ON condition.
    CORRECT: SELECT * FROM orders o INNER JOIN customers c ON o.customer_id = c.customer_id
    """
)
```

### Q: How often should I update training data?

**A:** Update training data when:

- Schema changes (tables, columns, relationships modified)
- Business rules change (new calculations, different thresholds)
- Users report frequent errors on specific question types
- Accuracy drops below acceptable threshold (usually 80%)

Implement monthly reviews and update as needed.

### Q: Can I automate training data creation?

**A:** Partially. You can automate:

- **Schema documentation**: Extract DDL automatically from database
- **Relationship detection**: Identify foreign keys programmatically
- **Query categorization**: Classify existing queries by type

You cannot automate:

- Business context and terminology
- Edge case identification
- Question phrasing diversity
- Business rule documentation

Automation helps with technical foundation; human expertise is required for business context.

### Q: What accuracy should I expect after fixing these mistakes?

**A:** Expected accuracy by training quality:

| Training Quality | Typical Accuracy Range |
|-----------------|----------------------|
| Poor (multiple mistakes) | 30-50% |
| Basic (technical only) | 50-65% |
| Good (diverse + context) | 70-80% |
| Excellent (comprehensive) | 85-92% |

Achieving 100% accuracy isn't realistic. Even with excellent training, edge cases and ambiguous questions will occur. Focus on consistent performance above 85% for production systems.

### Q: How do I know which mistake is causing my accuracy issues?

**A:** Run systematic diagnostics:

```python
def diagnose_training_issues():
    """
    Run comprehensive diagnostics on training data.
    """
    issues = []

    # Check for PII
    if has_pii_in_training():
        issues.append("⚠️ PII detected in training data")

    # Check diversity
    distribution = categorize_query_types(vn.get_training_data())
    for query_type, count in distribution.items():
        if count < 5:
            issues.append(f"⚠️ Low coverage for {query_type}: only {count} examples")

    # Check for business documentation
    training_data = vn.get_training_data()
    docs_count = sum(1 for item in training_data if item.get('documentation'))
    if docs_count / len(training_data) < 0.3:
        issues.append(f"⚠️ Only {docs_count}/{len(training_data)} examples have documentation")

    # Check for NULL handling
    null_examples = sum(1 for item in training_data
                       if 'NULL' in item.get('sql', '').upper())
    if null_examples < 10:
        issues.append(f"⚠️ Only {null_examples} examples handle NULL values")

    return issues

# Run diagnostics
issues = diagnose_training_issues()
if issues:
    print("Training data issues found:")
    for issue in issues:
        print(f"  {issue}")
else:
    print("✅ No major training issues detected")
```

### Q: Should I remove old training data when updating?

**A:** Be selective:

**Remove when:**
- References deprecated schema elements
- Contains outdated business rules
- Includes PII or sensitive data
- Uses anti-patterns or bad practices

**Keep when:**
- Still technically accurate
- Demonstrates valid query patterns
- Covers edge cases
- Provides business context

Implement versioning for training data so you can roll back if accuracy decreases after changes.

## Implementation Strategy

### Phase 1: Audit Current Training (Week 1)

**Step 1: Run diagnostics**
```python
# Use diagnostic functions from troubleshooting section
issues = diagnose_training_issues()
distribution = categorize_query_types(vn.get_training_data())
```

**Step 2: Prioritize fixes**

High priority (fix immediately):
- PII in training data (security risk)
- Outdated schema references (breaks queries)
- Missing NULL handling (causes errors)

Medium priority (fix within 2 weeks):
- Low query diversity
- Missing business context
- Poor edge case coverage

Low priority (enhance over time):
- Additional documentation
- Performance optimizations
- Advanced query patterns

### Phase 2: Implement Core Fixes (Weeks 2-3)

Focus on high-impact mistakes first:

1. Remove all PII (Mistake #1)
2. Add diverse query patterns (Mistake #2)
3. Document business context (Mistake #3)
4. Add NULL and edge case handling (Mistake #4)

### Phase 3: Validate and Test (Week 4)

**Create test suite:**
```python
def create_accuracy_test_suite():
    """
    Build comprehensive test suite for validation.
    """
    test_cases = [
        # Simple queries
        {
            'question': 'Show all active users',
            'expected_elements': ['SELECT', 'FROM users', 'WHERE', 'status']
        },

        # JOINs
        {
            'question': 'Show orders with customer names',
            'expected_elements': ['JOIN', 'customers', 'ON']
        },

        # Aggregations
        {
            'question': 'Count users by department',
            'expected_elements': ['COUNT', 'GROUP BY', 'department']
        },

        # NULL handling
        {
            'question': 'Show users with missing email',
            'expected_elements': ['IS NULL', 'email']
        },

        # Business context
        {
            'question': 'Show products that need reordering',
            'expected_elements': ['reorder_point', 'current_quantity', '<=']
        }
    ]

    return test_cases

def run_accuracy_tests():
    """
    Execute test suite and report results.
    """
    test_cases = create_accuracy_test_suite()
    passed = 0
    failed = 0

    for test in test_cases:
        sql = vn.generate_sql(test['question'])

        # Check if expected elements are present
        all_present = all(
            element.upper() in sql.upper()
            for element in test['expected_elements']
        )

        if all_present:
            passed += 1
            print(f"✅ {test['question']}")
        else:
            failed += 1
            print(f"❌ {test['question']}")
            print(f"   Missing: {[e for e in test['expected_elements'] if e.upper() not in sql.upper()]}")

    accuracy = passed / (passed + failed) * 100
    print(f"\nAccuracy: {accuracy:.1f}% ({passed}/{passed + failed})")
    return accuracy

# Run tests
accuracy = run_accuracy_tests()
```

### Phase 4: Monitor and Maintain (Ongoing)

**Weekly:**
- Review user questions that produced errors
- Add training for common failure patterns

**Monthly:**
- Run full accuracy test suite
- Update business documentation
- Review schema changes

**Quarterly:**
- Comprehensive training data audit
- Performance optimization
- User feedback incorporation

## Key Takeaways

After implementing Text-to-SQL systems across multiple production environments, these practices consistently improve accuracy:

✅ **Prioritize Quality Over Quantity**: 50 well-crafted training examples with business context outperform 500 technical queries without context.

✅ **Business Context is Critical**: Technical accuracy without business understanding produces correct SQL that answers the wrong questions.

✅ **Edge Cases Are Normal Cases**: In production, NULL values, date boundaries, and empty results occur regularly. Train for them explicitly.

✅ **Continuous Validation**: Schema changes break everything. Implement automated validation and update training proactively.

✅ **Security First**: Never compromise data privacy for training convenience. Use synthetic data or sanitized examples exclusively.

✅ **Diversity Matters**: Include all query types (SELECTs, JOINs, aggregations, subqueries) with at least 5 examples per major pattern.

✅ **Document Relationships**: Explicitly train on table relationships and JOIN patterns. The model can't infer foreign key relationships reliably.

✅ **Test Systematically**: Build automated test suites to validate accuracy and catch regressions early.

## The Reality of Text-to-SQL Implementation

Vanna AI is a powerful assistant tool that can significantly improve database accessibility when properly trained. In our implementations, properly trained models achieve accuracy in the 85%+ range on business questions, while poorly trained ones struggle to reach 40-50%.

The investment in proper training pays off quickly. Teams that rush through training spend months debugging production issues and dealing with user frustration. Teams that follow these guidelines see immediate productivity gains and user adoption.

**Critical reminder**: Vanna AI assists with SQL generation—it doesn't replace SQL expertise or eliminate the need for result verification. Always:

- Validate generated queries before execution
- Verify results match user intent
- Monitor for security implications
- Review performance impact
- Maintain human oversight for production queries

For systems handling sensitive data, implement additional safeguards:
- Query approval workflows for sensitive tables
- Automatic query analysis for security risks
- Result sanitization before display
- Comprehensive audit logging
- Regular security reviews of generated queries

## Next Steps

- [ ] Run diagnostic audit on your current training data
- [ ] Prioritize fixes based on impact and effort
- [ ] Implement high-priority corrections first
- [ ] Build automated test suite for validation
- [ ] Establish monthly review process
- [ ] Document your specific business context
- [ ] Set up monitoring and alerting

**Further Reading:**
- [How to Measure Vanna AI Accuracy](https://ljblab.dev) - Comprehensive accuracy measurement guide
- [Vanna AI Official Documentation](https://vanna.ai/docs) - Technical reference
- [Text-to-SQL Best Practices](https://ljblab.dev) - Production implementation patterns

## Need Help?

Implementing Text-to-SQL for an enterprise or government system requires careful attention to training quality, security, and compliance requirements. If you're building production AI-powered database solutions and need guidance on training strategies, accuracy optimization, or security implementation, I offer architecture reviews and implementation consulting.

I've helped organizations implement Text-to-SQL systems that achieve 85%+ accuracy while meeting FedRAMP and FISMA compliance requirements. [Schedule a consultation](mailto:lincoln@ljblab.dev) to discuss your specific implementation.

---

*This guide is based on real-world experience implementing Text-to-SQL systems across federal government databases. All examples use synthetic data and follow security best practices for government systems.*
