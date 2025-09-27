---
title: "Measuring and Improving Vanna AI Accuracy: A Data-Driven Approach"
description: "Learn how to systematically measure and improve Vanna AI accuracy through comprehensive testing, metrics tracking, and continuous improvement strategies based on real-world production experience."
publishDate: 2025-02-11
tags: ["AI", "Machine Learning", "Vanna AI", "Text-to-SQL", "Data Analytics", "Performance Testing"]
category: "AI/ML"
author: "Lincoln Bicalho"
draft: false
---

After deploying Vanna AI systems across multiple government databases, I've learned that accuracy isn't just about getting the right SQL—it's about building systematic approaches to measure, track, and continuously improve performance. Here's the data-driven methodology I've developed for optimizing Vanna AI accuracy in production environments.

The challenge isn't just technical; it's organizational. How do you convince stakeholders to invest in AI when accuracy varies wildly? How do you set realistic expectations while demonstrating continuous improvement? After managing these systems for government clients, I've discovered that the answer lies in treating accuracy as a measurable, improvable metric rather than a hope-and-pray deployment strategy.

## Understanding Vanna AI Accuracy Challenges

Traditional accuracy metrics fail with Text-to-SQL systems because they don't account for the complexity of natural language interpretation. A query like "Show me sales from last quarter" could generate syntactically correct SQL that returns wrong results due to date interpretation, table joins, or business logic assumptions.

In our government implementations, we've observed that basic semantic similarity scores often show 85-90% accuracy, but actual business-correct results typically range from 65-75% on initial deployment. This gap exists because:

**Query Ambiguity**: Natural language inherently contains ambiguity that even humans struggle with. "Recent sales" could mean today, this week, or this month depending on context.

**Schema Complexity**: Government databases often contain 200+ tables with similar-sounding columns. Vanna might correctly identify the need for a JOIN but select the wrong foreign key relationship.

**Business Logic Requirements**: Queries often require implicit business rules (active records only, specific date ranges, security filters) that aren't obvious from the natural language.

**Context Dependencies**: Follow-up questions rely on previous conversation context that can drift over multiple exchanges.

The key insight: measuring accuracy requires testing both syntactic correctness and semantic business value.

## Building a Comprehensive Query Accuracy Test Suite

The foundation of improvement is systematic measurement. Here's the testing framework I've implemented across multiple government systems:

```python
import json
import pandas as pd
from datetime import datetime
from typing import Dict, List, Tuple
import vanna
from dataclasses import dataclass

@dataclass
class QueryTestCase:
    id: str
    natural_language: str
    expected_sql: str
    expected_result_schema: Dict
    business_context: str
    difficulty_level: str  # 'basic', 'intermediate', 'advanced'
    categories: List[str]  # ['joins', 'aggregation', 'filtering']

class VannaAccuracyTester:
    def __init__(self, vanna_instance, test_database_connection):
        self.vanna = vanna_instance
        self.db_connection = test_database_connection
        self.test_cases = []
        self.results = []

    def load_test_cases(self, test_cases_file: str):
        """Load test cases from JSON file"""
        with open(test_cases_file, 'r') as f:
            data = json.load(f)
            self.test_cases = [QueryTestCase(**case) for case in data['test_cases']]

    def execute_accuracy_test(self, test_case: QueryTestCase) -> Dict:
        """Execute single test case and measure accuracy"""
        start_time = datetime.now()

        try:
            # Generate SQL from natural language
            generated_sql = self.vanna.generate_sql(test_case.natural_language)
            generation_time = (datetime.now() - start_time).total_seconds()

            # Execute both queries
            expected_results = pd.read_sql(test_case.expected_sql, self.db_connection)
            generated_results = pd.read_sql(generated_sql, self.db_connection)

            # Calculate various accuracy metrics
            accuracy_metrics = self._calculate_accuracy_metrics(
                test_case, generated_sql, expected_results, generated_results
            )

            return {
                'test_id': test_case.id,
                'generated_sql': generated_sql,
                'execution_successful': True,
                'generation_time_seconds': generation_time,
                **accuracy_metrics
            }

        except Exception as e:
            return {
                'test_id': test_case.id,
                'generated_sql': generated_sql if 'generated_sql' in locals() else None,
                'execution_successful': False,
                'error': str(e),
                'generation_time_seconds': (datetime.now() - start_time).total_seconds(),
                'syntax_accuracy': 0.0,
                'semantic_accuracy': 0.0,
                'result_accuracy': 0.0
            }

    def _calculate_accuracy_metrics(self, test_case, generated_sql, expected_df, generated_df) -> Dict:
        """Calculate comprehensive accuracy metrics"""

        # Syntax accuracy - SQL parsing and structure
        syntax_score = self._calculate_syntax_accuracy(test_case.expected_sql, generated_sql)

        # Semantic accuracy - logical equivalence
        semantic_score = self._calculate_semantic_accuracy(expected_df, generated_df)

        # Result accuracy - business value correctness
        result_score = self._calculate_result_accuracy(expected_df, generated_df)

        # Schema accuracy - column selection correctness
        schema_score = self._calculate_schema_accuracy(
            test_case.expected_result_schema,
            generated_df.columns.tolist()
        )

        return {
            'syntax_accuracy': syntax_score,
            'semantic_accuracy': semantic_score,
            'result_accuracy': result_score,
            'schema_accuracy': schema_score,
            'overall_accuracy': (syntax_score + semantic_score + result_score + schema_score) / 4
        }

    def _calculate_syntax_accuracy(self, expected_sql: str, generated_sql: str) -> float:
        """Measure SQL syntax and structure similarity"""
        # Parse SQL structures and compare
        expected_tokens = self._parse_sql_tokens(expected_sql)
        generated_tokens = self._parse_sql_tokens(generated_sql)

        # Calculate token overlap
        common_tokens = set(expected_tokens) & set(generated_tokens)
        total_tokens = set(expected_tokens) | set(generated_tokens)

        return len(common_tokens) / len(total_tokens) if total_tokens else 0.0

    def _calculate_semantic_accuracy(self, expected_df: pd.DataFrame, generated_df: pd.DataFrame) -> float:
        """Measure semantic equivalence of results"""
        if expected_df.shape != generated_df.shape:
            return 0.0

        try:
            # Sort both dataframes for comparison
            expected_sorted = expected_df.sort_values(expected_df.columns.tolist()).reset_index(drop=True)
            generated_sorted = generated_df.sort_values(generated_df.columns.tolist()).reset_index(drop=True)

            # Calculate row-wise accuracy
            matching_rows = 0
            for i in range(len(expected_sorted)):
                if expected_sorted.iloc[i].equals(generated_sorted.iloc[i]):
                    matching_rows += 1

            return matching_rows / len(expected_sorted)
        except:
            return 0.0

    def run_full_test_suite(self) -> pd.DataFrame:
        """Execute complete test suite and return results"""
        results = []

        for test_case in self.test_cases:
            result = self.execute_accuracy_test(test_case)
            result['difficulty'] = test_case.difficulty_level
            result['categories'] = ','.join(test_case.categories)
            results.append(result)

        self.results = pd.DataFrame(results)
        return self.results

    def generate_accuracy_report(self) -> Dict:
        """Generate comprehensive accuracy analysis"""
        if self.results.empty:
            return {}

        return {
            'overall_metrics': {
                'total_tests': len(self.results),
                'execution_success_rate': self.results['execution_successful'].mean(),
                'average_syntax_accuracy': self.results['syntax_accuracy'].mean(),
                'average_semantic_accuracy': self.results['semantic_accuracy'].mean(),
                'average_result_accuracy': self.results['result_accuracy'].mean(),
                'average_overall_accuracy': self.results['overall_accuracy'].mean()
            },
            'by_difficulty': self.results.groupby('difficulty').agg({
                'overall_accuracy': ['mean', 'std', 'count']
            }).round(3).to_dict(),
            'performance_distribution': {
                'high_accuracy_queries': (self.results['overall_accuracy'] >= 0.8).sum(),
                'medium_accuracy_queries': ((self.results['overall_accuracy'] >= 0.6) &
                                          (self.results['overall_accuracy'] < 0.8)).sum(),
                'low_accuracy_queries': (self.results['overall_accuracy'] < 0.6).sum()
            }
        }
```

This testing framework provides the foundation for systematic accuracy measurement. In our government implementations, we maintain 150-200 test cases covering common query patterns, edge cases, and business-specific scenarios.

## Measuring Confidence vs Actual Accuracy

One critical insight from production deployments: Vanna's confidence scores don't always correlate with actual accuracy. Here's how we measure and calibrate this relationship:

```python
class ConfidenceCalibrator:
    def __init__(self, vanna_instance):
        self.vanna = vanna_instance
        self.calibration_data = []

    def collect_confidence_accuracy_pairs(self, test_results: pd.DataFrame):
        """Collect confidence scores and actual accuracy for calibration"""
        for _, result in test_results.iterrows():
            if result['execution_successful']:
                # Get confidence score from Vanna
                confidence = self._extract_confidence_score(result['generated_sql'])
                actual_accuracy = result['overall_accuracy']

                self.calibration_data.append({
                    'confidence_score': confidence,
                    'actual_accuracy': actual_accuracy,
                    'test_id': result['test_id']
                })

    def _extract_confidence_score(self, generated_sql: str) -> float:
        """Extract confidence score from Vanna's response metadata"""
        # Implementation depends on Vanna version and configuration
        # This is a simplified example
        try:
            # Assume Vanna provides confidence in metadata
            return self.vanna.get_last_confidence_score()
        except:
            return 0.5  # Default neutral confidence

    def analyze_confidence_calibration(self) -> Dict:
        """Analyze how well confidence scores predict actual accuracy"""
        if not self.calibration_data:
            return {}

        df = pd.DataFrame(self.calibration_data)

        # Create confidence bins
        df['confidence_bin'] = pd.cut(df['confidence_score'],
                                    bins=[0, 0.3, 0.5, 0.7, 0.9, 1.0],
                                    labels=['Very Low', 'Low', 'Medium', 'High', 'Very High'])

        calibration_analysis = df.groupby('confidence_bin').agg({
            'actual_accuracy': ['mean', 'std', 'count'],
            'confidence_score': 'mean'
        }).round(3)

        return {
            'calibration_by_confidence': calibration_analysis.to_dict(),
            'correlation': df['confidence_score'].corr(df['actual_accuracy']),
            'reliability_threshold': self._find_reliability_threshold(df)
        }

    def _find_reliability_threshold(self, df: pd.DataFrame) -> float:
        """Find confidence threshold where accuracy consistently exceeds target"""
        target_accuracy = 0.8

        for threshold in [0.5, 0.6, 0.7, 0.8, 0.9]:
            high_confidence_queries = df[df['confidence_score'] >= threshold]
            if len(high_confidence_queries) > 10:  # Minimum sample size
                avg_accuracy = high_confidence_queries['actual_accuracy'].mean()
                if avg_accuracy >= target_accuracy:
                    return threshold

        return 0.9  # Conservative default
```

In our experience, initial Vanna deployments show weak correlation between confidence and accuracy (typically 0.3-0.5 correlation coefficient). However, with proper training data curation and fine-tuning, this correlation can improve to 0.7-0.8, making confidence scores more useful for production routing decisions.

## A/B Testing Different Training Approaches

Systematic improvement requires controlled experimentation. Here's our A/B testing framework for training approaches:

```python
class VannaTrainingExperiment:
    def __init__(self, base_vanna_instance, test_database):
        self.base_vanna = base_vanna_instance
        self.test_db = test_database
        self.experiments = {}
        self.results = {}

    def create_training_variant(self, variant_name: str, training_config: Dict):
        """Create a new training variant for A/B testing"""
        variant_vanna = vanna.create_instance(training_config)
        self.experiments[variant_name] = {
            'instance': variant_vanna,
            'config': training_config,
            'training_data': []
        }

    def add_training_approaches(self):
        """Define different training approaches to test"""

        # Approach A: High-volume general training
        self.create_training_variant('high_volume_general', {
            'training_data_size': 1000,
            'data_selection': 'random_diverse',
            'fine_tuning_epochs': 3,
            'learning_rate': 0.001
        })

        # Approach B: Curated domain-specific training
        self.create_training_variant('curated_domain', {
            'training_data_size': 300,
            'data_selection': 'domain_specific',
            'fine_tuning_epochs': 5,
            'learning_rate': 0.0005
        })

        # Approach C: Iterative feedback-based training
        self.create_training_variant('iterative_feedback', {
            'training_data_size': 500,
            'data_selection': 'feedback_weighted',
            'fine_tuning_epochs': 4,
            'learning_rate': 0.0008,
            'use_human_feedback': True
        })

    def execute_training_experiment(self, training_data: List[Dict], test_cases: List[QueryTestCase]):
        """Execute A/B test across all training variants"""
        results = {}

        for variant_name, variant_config in self.experiments.items():
            print(f"Training variant: {variant_name}")

            # Prepare training data according to variant strategy
            filtered_training_data = self._prepare_training_data(
                training_data, variant_config['config']
            )

            # Train the variant
            variant_instance = variant_config['instance']
            self._train_variant(variant_instance, filtered_training_data, variant_config['config'])

            # Test the variant
            tester = VannaAccuracyTester(variant_instance, self.test_db)
            tester.test_cases = test_cases
            test_results = tester.run_full_test_suite()

            # Collect results
            results[variant_name] = {
                'config': variant_config['config'],
                'training_data_count': len(filtered_training_data),
                'test_results': test_results,
                'summary_metrics': tester.generate_accuracy_report()
            }

        self.results = results
        return results

    def _prepare_training_data(self, training_data: List[Dict], config: Dict) -> List[Dict]:
        """Filter and prepare training data based on variant configuration"""
        data_selection = config.get('data_selection', 'random_diverse')
        target_size = config.get('training_data_size', 500)

        if data_selection == 'random_diverse':
            # Random sampling with diversity constraints
            return self._sample_diverse_training_data(training_data, target_size)

        elif data_selection == 'domain_specific':
            # Focus on domain-specific high-quality examples
            return self._select_domain_specific_data(training_data, target_size)

        elif data_selection == 'feedback_weighted':
            # Weight by human feedback scores
            return self._select_feedback_weighted_data(training_data, target_size)

        return training_data[:target_size]

    def analyze_experiment_results(self) -> Dict:
        """Analyze A/B test results and identify best approach"""
        if not self.results:
            return {}

        comparison = {}

        for variant_name, variant_results in self.results.items():
            metrics = variant_results['summary_metrics']['overall_metrics']
            comparison[variant_name] = {
                'overall_accuracy': metrics['average_overall_accuracy'],
                'execution_success_rate': metrics['execution_success_rate'],
                'training_data_size': variant_results['training_data_count'],
                'cost_efficiency': metrics['average_overall_accuracy'] / variant_results['training_data_count']
            }

        # Find best performing variant
        best_variant = max(comparison.keys(),
                          key=lambda x: comparison[x]['overall_accuracy'])

        return {
            'variant_comparison': comparison,
            'best_variant': best_variant,
            'improvement_vs_baseline': self._calculate_improvement_vs_baseline(comparison),
            'recommendations': self._generate_training_recommendations(comparison)
        }

    def _generate_training_recommendations(self, comparison: Dict) -> List[str]:
        """Generate actionable recommendations based on experiment results"""
        recommendations = []

        # Analyze cost-efficiency
        best_efficiency = max(comparison.values(), key=lambda x: x['cost_efficiency'])
        recommendations.append(
            f"Most cost-efficient approach achieves {best_efficiency['cost_efficiency']:.3f} accuracy per training example"
        )

        # Analyze accuracy vs data size
        high_accuracy_variants = [k for k, v in comparison.items() if v['overall_accuracy'] > 0.75]
        if high_accuracy_variants:
            recommendations.append(
                f"High accuracy (>75%) achieved with variants: {', '.join(high_accuracy_variants)}"
            )

        return recommendations
```

Our A/B testing across government systems consistently shows that curated, domain-specific training data outperforms high-volume general training. Typically, 300 carefully selected examples achieve better accuracy than 1000 random examples, while requiring 60% less training time.

## Creating Feedback Loops for Continuous Improvement

The most successful Vanna implementations include systematic feedback collection and automated improvement cycles:

```python
class ContinuousImprovementSystem:
    def __init__(self, vanna_instance, accuracy_threshold=0.8):
        self.vanna = vanna_instance
        self.accuracy_threshold = accuracy_threshold
        self.feedback_queue = []
        self.improvement_metrics = {}

    def collect_user_feedback(self, query: str, generated_sql: str,
                            user_rating: int, corrected_sql: str = None):
        """Collect user feedback for continuous improvement"""
        feedback_entry = {
            'timestamp': datetime.now(),
            'natural_language_query': query,
            'generated_sql': generated_sql,
            'user_rating': user_rating,  # 1-5 scale
            'corrected_sql': corrected_sql,
            'feedback_type': 'correction' if corrected_sql else 'rating'
        }

        self.feedback_queue.append(feedback_entry)

        # Trigger improvement if we have enough feedback
        if len(self.feedback_queue) >= 50:
            self.process_feedback_batch()

    def process_feedback_batch(self):
        """Process accumulated feedback and improve model"""
        if len(self.feedback_queue) < 10:
            return

        # Analyze feedback patterns
        feedback_df = pd.DataFrame(self.feedback_queue)

        # Identify improvement opportunities
        low_rated_queries = feedback_df[feedback_df['user_rating'] <= 2]
        corrected_queries = feedback_df[feedback_df['corrected_sql'].notna()]

        # Create new training examples from corrections
        new_training_examples = []
        for _, correction in corrected_queries.iterrows():
            new_training_examples.append({
                'question': correction['natural_language_query'],
                'sql': correction['corrected_sql'],
                'source': 'user_correction',
                'confidence': 1.0  # High confidence in human corrections
            })

        # Retrain with new examples
        if new_training_examples:
            self.incremental_training(new_training_examples)

        # Clear processed feedback
        self.feedback_queue = []

    def incremental_training(self, new_examples: List[Dict]):
        """Perform incremental training with new examples"""
        print(f"Performing incremental training with {len(new_examples)} new examples")

        # Add new examples to training data
        for example in new_examples:
            self.vanna.train(
                question=example['question'],
                sql=example['sql']
            )

        # Track improvement metrics
        self.improvement_metrics[datetime.now()] = {
            'new_examples_added': len(new_examples),
            'total_training_examples': self.vanna.get_training_data_count(),
            'improvement_trigger': 'user_feedback'
        }

    def automated_quality_monitoring(self, test_cases: List[QueryTestCase]):
        """Monitor quality and trigger retraining when accuracy drops"""
        tester = VannaAccuracyTester(self.vanna, self.test_db)
        tester.test_cases = test_cases
        current_results = tester.run_full_test_suite()

        current_accuracy = current_results['overall_accuracy'].mean()

        # Check if accuracy has dropped below threshold
        if current_accuracy < self.accuracy_threshold:
            print(f"Accuracy dropped to {current_accuracy:.3f}, triggering improvement cycle")
            self.trigger_improvement_cycle(current_results)

        return current_accuracy

    def trigger_improvement_cycle(self, poor_performance_results: pd.DataFrame):
        """Trigger comprehensive improvement when performance drops"""

        # Identify worst-performing query types
        poor_queries = poor_performance_results[
            poor_performance_results['overall_accuracy'] < 0.5
        ]

        # Generate additional training examples for problem areas
        improvement_examples = self.generate_targeted_training_examples(poor_queries)

        # Perform focused retraining
        self.incremental_training(improvement_examples)

        # Schedule follow-up testing
        self.schedule_accuracy_retest()

    def generate_improvement_report(self) -> Dict:
        """Generate report on continuous improvement activities"""
        if not self.improvement_metrics:
            return {'status': 'No improvement activities recorded'}

        total_examples_added = sum(
            metrics['new_examples_added']
            for metrics in self.improvement_metrics.values()
        )

        improvement_frequency = len(self.improvement_metrics) / 30  # Per month

        return {
            'total_improvement_cycles': len(self.improvement_metrics),
            'total_examples_added': total_examples_added,
            'improvement_frequency_per_month': improvement_frequency,
            'latest_metrics': list(self.improvement_metrics.values())[-1] if self.improvement_metrics else None,
            'feedback_queue_size': len(self.feedback_queue)
        }
```

## When to Retrain vs Fine-tune

One of the most critical decisions in maintaining Vanna AI accuracy is choosing between full retraining and incremental fine-tuning. Here's the decision framework I've developed:

**Retrain Completely When**:
- Accuracy drops below 60% on core query types
- Schema changes affect more than 30% of tables
- Business logic requirements fundamentally change
- Initial training data quality was poor

**Fine-tune When**:
- Accuracy is 65-80% and needs incremental improvement
- New query patterns emerge but core functionality works
- User feedback provides specific corrections
- Adding new data sources to existing schema

```python
class TrainingDecisionEngine:
    def __init__(self, accuracy_history: List[float], schema_change_rate: float):
        self.accuracy_history = accuracy_history
        self.schema_change_rate = schema_change_rate
        self.decision_criteria = {
            'accuracy_threshold_retrain': 0.60,
            'accuracy_threshold_finetune': 0.65,
            'schema_change_threshold': 0.30,
            'accuracy_decline_threshold': 0.15
        }

    def recommend_training_approach(self, current_accuracy: float,
                                  recent_schema_changes: int,
                                  total_tables: int) -> Dict:
        """Recommend whether to retrain or fine-tune based on current state"""

        schema_change_percentage = recent_schema_changes / total_tables
        accuracy_decline = max(self.accuracy_history) - current_accuracy if self.accuracy_history else 0

        recommendation = {
            'approach': 'maintain',
            'confidence': 0.5,
            'reasoning': [],
            'estimated_improvement': 0.0,
            'estimated_effort_hours': 0
        }

        # Check for full retraining conditions
        if current_accuracy < self.decision_criteria['accuracy_threshold_retrain']:
            recommendation.update({
                'approach': 'full_retrain',
                'confidence': 0.9,
                'reasoning': [f'Accuracy {current_accuracy:.3f} below critical threshold'],
                'estimated_improvement': 0.20,
                'estimated_effort_hours': 40
            })

        elif schema_change_percentage > self.decision_criteria['schema_change_threshold']:
            recommendation.update({
                'approach': 'full_retrain',
                'confidence': 0.8,
                'reasoning': [f'Major schema changes: {schema_change_percentage:.1%}'],
                'estimated_improvement': 0.15,
                'estimated_effort_hours': 35
            })

        # Check for fine-tuning conditions
        elif (current_accuracy < self.decision_criteria['accuracy_threshold_finetune'] or
              accuracy_decline > self.decision_criteria['accuracy_decline_threshold']):
            recommendation.update({
                'approach': 'fine_tune',
                'confidence': 0.7,
                'reasoning': [
                    f'Accuracy {current_accuracy:.3f} suggests incremental improvement needed',
                    f'Recent decline: {accuracy_decline:.3f}'
                ],
                'estimated_improvement': 0.10,
                'estimated_effort_hours': 15
            })

        return recommendation
```

## Tracking Query Performance Metrics

Comprehensive performance tracking goes beyond accuracy to include operational metrics that affect user experience:

```python
class QueryPerformanceTracker:
    def __init__(self):
        self.performance_log = []
        self.metrics_cache = {}

    def log_query_performance(self, query: str, sql: str, execution_time: float,
                            result_count: int, accuracy_score: float, user_satisfaction: int):
        """Log comprehensive performance metrics for each query"""

        performance_entry = {
            'timestamp': datetime.now(),
            'query_hash': hash(query),
            'natural_language_query': query,
            'generated_sql': sql,
            'execution_time_seconds': execution_time,
            'result_count': result_count,
            'accuracy_score': accuracy_score,
            'user_satisfaction': user_satisfaction,
            'query_complexity': self._calculate_query_complexity(sql),
            'token_count': len(query.split()),
            'sql_length': len(sql)
        }

        self.performance_log.append(performance_entry)

    def _calculate_query_complexity(self, sql: str) -> str:
        """Categorize query complexity based on SQL features"""
        sql_lower = sql.lower()

        complexity_indicators = {
            'joins': sql_lower.count('join'),
            'subqueries': sql_lower.count('select') - 1,
            'aggregations': sum([sql_lower.count(func) for func in ['sum(', 'count(', 'avg(', 'max(', 'min(']]),
            'conditions': sql_lower.count('where') + sql_lower.count('having')
        }

        total_complexity = sum(complexity_indicators.values())

        if total_complexity <= 2:
            return 'simple'
        elif total_complexity <= 5:
            return 'moderate'
        else:
            return 'complex'

    def generate_performance_dashboard(self) -> Dict:
        """Generate comprehensive performance analytics"""
        if not self.performance_log:
            return {}

        df = pd.DataFrame(self.performance_log)

        # Time-based performance trends
        df['date'] = df['timestamp'].dt.date
        daily_metrics = df.groupby('date').agg({
            'accuracy_score': 'mean',
            'execution_time_seconds': 'mean',
            'user_satisfaction': 'mean',
            'query_hash': 'nunique'
        }).rename(columns={'query_hash': 'unique_queries'})

        # Complexity-based analysis
        complexity_metrics = df.groupby('query_complexity').agg({
            'accuracy_score': ['mean', 'std'],
            'execution_time_seconds': ['mean', 'std'],
            'user_satisfaction': 'mean'
        })

        # Performance distribution
        performance_distribution = {
            'high_accuracy_queries': (df['accuracy_score'] >= 0.8).mean(),
            'fast_queries': (df['execution_time_seconds'] <= 2.0).mean(),
            'satisfied_users': (df['user_satisfaction'] >= 4).mean()
        }

        return {
            'daily_trends': daily_metrics.to_dict(),
            'complexity_analysis': complexity_metrics.to_dict(),
            'performance_distribution': performance_distribution,
            'overall_metrics': {
                'average_accuracy': df['accuracy_score'].mean(),
                'average_execution_time': df['execution_time_seconds'].mean(),
                'average_satisfaction': df['user_satisfaction'].mean(),
                'total_queries_processed': len(df)
            }
        }
```

## Cost-Benefit Analysis of Training Investment

Training investment decisions require clear ROI analysis. Here's the framework I use to justify training costs to stakeholders:

```python
class TrainingROICalculator:
    def __init__(self, current_accuracy: float, baseline_metrics: Dict):
        self.current_accuracy = current_accuracy
        self.baseline_metrics = baseline_metrics
        self.cost_factors = {
            'engineer_hourly_rate': 75,  # Senior engineer rate
            'compute_cost_per_hour': 12,  # GPU training costs
            'data_scientist_hourly_rate': 85,
            'opportunity_cost_multiplier': 1.5
        }

    def calculate_training_investment_cost(self, training_approach: str) -> Dict:
        """Calculate total cost of training investment"""

        training_costs = {
            'fine_tune': {
                'engineer_hours': 15,
                'data_scientist_hours': 8,
                'compute_hours': 4,
                'data_preparation_hours': 12
            },
            'full_retrain': {
                'engineer_hours': 40,
                'data_scientist_hours': 25,
                'compute_hours': 15,
                'data_preparation_hours': 30
            },
            'continuous_improvement_setup': {
                'engineer_hours': 60,
                'data_scientist_hours': 20,
                'compute_hours': 8,
                'data_preparation_hours': 25
            }
        }

        costs = training_costs.get(training_approach, training_costs['fine_tune'])

        total_cost = (
            costs['engineer_hours'] * self.cost_factors['engineer_hourly_rate'] +
            costs['data_scientist_hours'] * self.cost_factors['data_scientist_hourly_rate'] +
            costs['compute_hours'] * self.cost_factors['compute_cost_per_hour'] +
            costs['data_preparation_hours'] * self.cost_factors['engineer_hourly_rate']
        )

        # Add opportunity cost
        total_cost *= self.cost_factors['opportunity_cost_multiplier']

        return {
            'direct_cost': total_cost / self.cost_factors['opportunity_cost_multiplier'],
            'opportunity_cost': total_cost - (total_cost / self.cost_factors['opportunity_cost_multiplier']),
            'total_investment': total_cost,
            'cost_breakdown': costs
        }

    def estimate_accuracy_improvement_value(self, target_accuracy: float,
                                          monthly_queries: int) -> Dict:
        """Calculate business value of accuracy improvement"""

        accuracy_improvement = target_accuracy - self.current_accuracy

        # Value calculations based on common business metrics
        value_per_accurate_query = 2.50  # Estimated value per correctly answered query
        cost_per_incorrect_query = 15.00  # Cost of manual correction/confusion

        current_monthly_value = monthly_queries * self.current_accuracy * value_per_accurate_query
        target_monthly_value = monthly_queries * target_accuracy * value_per_accurate_query

        current_monthly_cost = monthly_queries * (1 - self.current_accuracy) * cost_per_incorrect_query
        target_monthly_cost = monthly_queries * (1 - target_accuracy) * cost_per_incorrect_query

        monthly_benefit = (target_monthly_value - current_monthly_value) + (current_monthly_cost - target_monthly_cost)
        annual_benefit = monthly_benefit * 12

        return {
            'accuracy_improvement': accuracy_improvement,
            'monthly_benefit': monthly_benefit,
            'annual_benefit': annual_benefit,
            'value_metrics': {
                'additional_accurate_queries_monthly': monthly_queries * accuracy_improvement,
                'reduced_error_cost_monthly': (current_monthly_cost - target_monthly_cost),
                'increased_value_monthly': (target_monthly_value - current_monthly_value)
            }
        }

    def calculate_roi(self, training_approach: str, target_accuracy: float,
                     monthly_queries: int, time_horizon_months: int = 12) -> Dict:
        """Calculate complete ROI analysis for training investment"""

        investment_cost = self.calculate_training_investment_cost(training_approach)
        improvement_value = self.estimate_accuracy_improvement_value(target_accuracy, monthly_queries)

        total_benefit = improvement_value['monthly_benefit'] * time_horizon_months
        total_cost = investment_cost['total_investment']

        roi_percentage = ((total_benefit - total_cost) / total_cost) * 100 if total_cost > 0 else 0
        payback_months = total_cost / improvement_value['monthly_benefit'] if improvement_value['monthly_benefit'] > 0 else float('inf')

        return {
            'investment_summary': {
                'total_cost': total_cost,
                'total_benefit': total_benefit,
                'net_benefit': total_benefit - total_cost,
                'roi_percentage': roi_percentage,
                'payback_period_months': payback_months
            },
            'recommendation': self._generate_roi_recommendation(roi_percentage, payback_months),
            'sensitivity_analysis': self._perform_sensitivity_analysis(
                training_approach, target_accuracy, monthly_queries
            )
        }

    def _generate_roi_recommendation(self, roi_percentage: float, payback_months: float) -> str:
        """Generate investment recommendation based on ROI metrics"""

        if roi_percentage >= 200 and payback_months <= 6:
            return "Strong recommendation: High ROI with quick payback"
        elif roi_percentage >= 100 and payback_months <= 12:
            return "Recommended: Positive ROI within reasonable timeframe"
        elif roi_percentage >= 50 and payback_months <= 18:
            return "Consider: Moderate ROI, evaluate against other priorities"
        else:
            return "Not recommended: Low ROI or extended payback period"
```

## Setting Realistic Accuracy Targets

Based on implementations across multiple government databases, here are realistic accuracy expectations for different deployment scenarios:

**Initial Deployment (Month 1)**:
- Simple queries (single table, basic filters): 70-80%
- Moderate queries (2-3 table joins): 55-65%
- Complex queries (multiple joins, subqueries): 35-45%
- Overall blended accuracy: 60-70%

**After 3 Months of Optimization**:
- Simple queries: 85-90%
- Moderate queries: 70-80%
- Complex queries: 55-65%
- Overall blended accuracy: 75-85%

**Mature Implementation (6+ Months)**:
- Simple queries: 90-95%
- Moderate queries: 80-85%
- Complex queries: 65-75%
- Overall blended accuracy: 80-90%

The key insight: Perfect accuracy isn't the goal—consistent, predictable accuracy with clear confidence indicators enables successful production deployment.

## Key Takeaways for Production Success

After managing Vanna AI implementations across multiple government systems, these principles have proven essential:

**Measure Everything**: Accuracy without measurement is just hope. Implement comprehensive testing frameworks from day one, not after problems emerge.

**Embrace Imperfection**: 85% accuracy with reliable confidence scores outperforms 95% accuracy with unpredictable failures. Focus on predictability over perfection.

**Automate Improvement**: Manual accuracy improvements don't scale. Build feedback loops and automated retraining into your initial architecture.

**Monitor Continuously**: Accuracy degrades over time as data and usage patterns evolve. Automated monitoring catches problems before users do.

**Invest Strategically**: Training costs compound quickly. Use ROI analysis to prioritize improvements that deliver measurable business value.

The most successful Vanna AI deployments treat accuracy as a product feature to be engineered, measured, and continuously improved—not a technical achievement to be declared complete.

Ready to implement systematic accuracy improvement in your Vanna AI deployment? Start with the testing framework, establish baseline measurements, and build improvement processes before scaling to production users.

*Have you implemented accuracy measurement systems for Text-to-SQL applications? I'd love to hear about your approaches and challenges in the comments below.*