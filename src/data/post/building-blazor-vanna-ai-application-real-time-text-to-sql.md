---
publishDate: 2024-12-03T09:00:00Z
title: 'Building a Blazor + Vanna AI Application: Real-Time Text-to-SQL Interface'
excerpt: Learn how to integrate Vanna AI with Blazor Server to create a production-ready text-to-SQL interface. This comprehensive tutorial covers component architecture, API integration, real-time validation, and confidence scoring for enterprise systems.
image: ~/assets/images/blazor-vanna-ai.jpg
category: Blazor
tags:
  - blazor
  - vanna-ai
  - text-to-sql
  - ai-integration
  - csharp
metadata:
  canonical: https://ljblab.dev/building-blazor-vanna-ai-application-real-time-text-to-sql
author: Lincoln J Bicalho
---

> 📋 **Prerequisites**:
> - .NET 8 SDK or later
> - Visual Studio 2022 or VS Code with C# extension
> - Basic understanding of Blazor Server and component lifecycle
> - Vanna AI API access and API key
> - Familiarity with dependency injection in ASP.NET Core
> - Understanding of async/await patterns in C#

## Overview

Text-to-SQL systems bridge the gap between natural language and database queries, enabling users to access data without SQL expertise. However, integrating AI-powered query generation into production applications requires more than just API calls—you need transparent confidence scoring, security validation, and real-time feedback mechanisms that users can trust.

This tutorial demonstrates how to build a production-ready Blazor Server application that integrates Vanna AI for text-to-SQL functionality. You'll learn to create a transparent interface that provides confidence indicators, validation workflows, and real-time query analysis—essential features for enterprise and government deployments.

**What you'll build:**
- A responsive text-to-SQL interface with real-time validation
- Service layer with confidence scoring and security checks
- Component architecture supporting multiple render modes
- Production-ready error handling and user feedback

**Why this approach matters:**

In federal database systems, transparency isn't optional—it's required. When a compliance officer transforms a natural language query into SQL affecting thousands of records, they need to understand:
- How confident the AI is in the generated query
- Which tables and data the query accesses
- Potential security or performance risks
- Whether the query has been validated

This tutorial shows you how to implement these trust-building features while maintaining excellent user experience.

## Key Concepts

### Concept 1: AI Transparency Through Confidence Scoring

Vanna AI provides confidence scores indicating how well it understands a query. Your application should surface this information to users, enabling them to make informed decisions about query execution.

**Why confidence scores matter:**
- Users need to know when AI might misinterpret their intent
- Low confidence queries require additional verification
- Confidence trends help improve training data over time
- Audit trails require confidence level documentation

**When to use different confidence thresholds:**
- **High (80%+)**: Auto-suggest execution with standard validation
- **Medium (60-79%)**: Show query but require user review
- **Low (<60%)**: Flag for manual verification and potential refinement

**Trade-offs:**
- **Automatic execution**: Faster workflow but higher risk of errors
- **Manual review**: Safer but slower user experience
- **Hybrid approach**: Balance based on confidence levels (recommended)

> 💡 **Tip**: In production systems, adjust confidence thresholds based on query complexity. Queries involving multiple tables or subqueries should require higher confidence scores before execution.

### Concept 2: Multi-Layer Validation Architecture

Your application needs validation at multiple levels to prevent security issues and performance problems:

1. **AI Confidence Validation**: Vanna AI's own assessment of query accuracy
2. **Security Pattern Validation**: Server-side checks for dangerous SQL operations
3. **Performance Validation**: Detection of potentially expensive queries
4. **Business Rule Validation**: Application-specific constraints

**Integration pattern:**
```
User Input → Vanna AI → Confidence Check → Security Validation → Performance Check → Execution
```

Each validation layer can halt the process, ensuring multiple safety checkpoints before query execution.

> ⚠️ **Warning**: Never rely solely on AI confidence scores for security validation. Always implement server-side security checks for SQL injection patterns and dangerous operations.

### Concept 3: Component Communication in Blazor Server

Blazor Server maintains a persistent connection between the client and server via SignalR. Understanding this architecture is crucial for implementing real-time feedback:

- **Component Lifecycle**: Components render server-side, sending UI updates via SignalR
- **State Management**: Component state persists across interactions within the same circuit
- **Real-time Updates**: Use `StateHasChanged()` to trigger UI updates after async operations

**When you need this pattern:**
- Real-time validation feedback as users type
- Progressive query generation with multiple steps
- Live confidence score updates during processing

**Performance considerations:**
- Excessive `StateHasChanged()` calls can impact performance
- Debounce user input to reduce server roundtrips
- Cache validation results when possible

## Component Architecture Overview

Your Blazor + Vanna AI application consists of three main layers:

```
┌─────────────────────────────────────────┐
│   QueryInterface.razor                  │
│   - User input collection               │
│   - Real-time validation feedback       │
│   - Confidence visualization            │
│   - Results display                     │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│   VannaService (IVannaService)          │
│   - API communication                   │
│   - Confidence adjustment               │
│   - Security validation                 │
│   - Query execution                     │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│   Vanna AI API                          │
│   - SQL generation                      │
│   - Confidence scoring                  │
│   - Query explanation                   │
└─────────────────────────────────────────┘
```

**Component responsibilities:**

- **Presentation Layer**: Handles user interaction, displays results, manages UI state
- **Service Layer**: Encapsulates business logic, API communication, validation
- **External API**: Provides AI-powered SQL generation and analysis

> ℹ️ **Note**: This architecture separates concerns, making the application easier to test and maintain. You can swap Vanna AI for another service without changing the component layer.

## Basic Implementation

### Step 1: Create the Project Structure

Create a new Blazor Server project and install required dependencies:

```bash
# Create new Blazor Server project
dotnet new blazorserver -n VannaBlazorApp
cd VannaBlazorApp

# Add required packages
dotnet add package Microsoft.Extensions.Http
dotnet add package System.Text.Json
```

**Why these packages:**
- `Microsoft.Extensions.Http`: Provides `IHttpClientFactory` for efficient API communication
- `System.Text.Json`: Modern JSON serialization with better performance than Newtonsoft.Json

### Step 2: Define Data Models

Create models that represent Vanna AI's request and response structures:

```csharp
// FILE: Models/VannaModels.cs
// PURPOSE: Define data contracts for Vanna AI integration
using System.Text.Json.Serialization;

namespace VannaBlazorApp.Models
{
    /// <summary>
    /// Represents a request to generate SQL from natural language
    /// </summary>
    public class QueryRequest
    {
        // WHY: Question property accepts natural language input from users
        public string Question { get; set; } = string.Empty;

        // WHY: DatabaseSchema helps Vanna AI understand available tables/columns
        public string DatabaseSchema { get; set; } = string.Empty;
    }

    /// <summary>
    /// Represents Vanna AI's response with generated SQL and metadata
    /// </summary>
    public class QueryResponse
    {
        // WHY: JsonPropertyName maps C# properties to Vanna API's JSON format
        [JsonPropertyName("sql")]
        public string Sql { get; set; } = string.Empty;

        // WHY: Confidence indicates how certain Vanna AI is about the query
        // Range: 0-100, higher values indicate greater confidence
        [JsonPropertyName("confidence")]
        public decimal Confidence { get; set; }

        // WHY: Explanation helps users understand what the query does
        [JsonPropertyName("explanation")]
        public string Explanation { get; set; } = string.Empty;

        // WHY: TablesUsed shows which database tables the query accesses
        [JsonPropertyName("tables_used")]
        public List<string> TablesUsed { get; set; } = new();

        // WHY: PotentialIssues flags concerns identified during generation
        [JsonPropertyName("potential_issues")]
        public List<string> PotentialIssues { get; set; } = new();
    }

    /// <summary>
    /// Represents the result of executing a generated SQL query
    /// </summary>
    public class QueryResult
    {
        public bool Success { get; set; }
        public string ErrorMessage { get; set; } = string.Empty;

        // WHY: Dynamic structure supports any query result shape
        public List<Dictionary<string, object>> Data { get; set; } = new();

        public int RowCount { get; set; }
        public TimeSpan ExecutionTime { get; set; }
    }

    /// <summary>
    /// Represents security and performance validation results
    /// </summary>
    public class ValidationResult
    {
        public bool IsValid { get; set; }
        public List<string> Warnings { get; set; } = new();
        public List<string> Errors { get; set; } = new();

        // WHY: SecurityRisk categorizes potential security concerns
        public SecurityRisk SecurityRisk { get; set; }
    }

    /// <summary>
    /// Security risk levels for generated queries
    /// </summary>
    public enum SecurityRisk
    {
        Low,      // Read-only queries with proper constraints
        Medium,   // Complex queries or missing performance limits
        High,     // Potential security issues detected
        Critical  // Dangerous operations like DELETE or DROP
    }
}
```

> ℹ️ **Note**: The `Dictionary<string, object>` approach for query results provides flexibility but sacrifices type safety. For production applications with known schemas, consider using strongly-typed result models.

### Step 3: Implement the Service Layer

Create a service that handles all Vanna AI communication and validation:

```csharp
// FILE: Services/VannaService.cs
// PURPOSE: Encapsulate Vanna AI integration and business logic
using VannaBlazorApp.Models;
using System.Text;
using System.Text.Json;

namespace VannaBlazorApp.Services
{
    public interface IVannaService
    {
        Task<QueryResponse> GenerateQueryAsync(QueryRequest request);
        Task<ValidationResult> ValidateQueryAsync(string sql);
        Task<QueryResult> ExecuteQueryAsync(string sql);
    }

    public class VannaService : IVannaService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<VannaService> _logger;
        private readonly IConfiguration _configuration;

        public VannaService(
            HttpClient httpClient,
            ILogger<VannaService> logger,
            IConfiguration configuration)
        {
            _httpClient = httpClient;
            _logger = logger;
            _configuration = configuration;

            // WHY: Configure base URL once instead of per-request
            _httpClient.BaseAddress = new Uri(
                _configuration["VannaAI:BaseUrl"] ?? "https://api.vanna.ai/");

            // WHY: Authorization header required for all Vanna AI API calls
            _httpClient.DefaultRequestHeaders.Add("Authorization",
                $"Bearer {_configuration["VannaAI:ApiKey"]}");
        }

        public async Task<QueryResponse> GenerateQueryAsync(QueryRequest request)
        {
            try
            {
                // HOW: Serialize request to JSON for API transmission
                var jsonContent = JsonSerializer.Serialize(request);
                var content = new StringContent(
                    jsonContent,
                    Encoding.UTF8,
                    "application/json");

                // WHY: POST to generate-sql endpoint initiates query generation
                var response = await _httpClient.PostAsync("generate-sql", content);
                response.EnsureSuccessStatusCode();

                var responseJson = await response.Content.ReadAsStringAsync();
                var queryResponse = JsonSerializer.Deserialize<QueryResponse>(responseJson);

                // WHY: Adjust confidence based on production experience
                // Vanna's scores need calibration for real-world complexity
                queryResponse = AdjustConfidenceScore(queryResponse);

                _logger.LogInformation(
                    "Generated query with confidence: {Confidence}",
                    queryResponse?.Confidence);

                return queryResponse ?? new QueryResponse();
            }
            catch (HttpRequestException ex)
            {
                // WHY: Log API communication failures for debugging
                _logger.LogError(ex, "API communication error for: {Question}",
                    request.Question);

                return new QueryResponse
                {
                    Sql = "",
                    Confidence = 0,
                    Explanation = "Error generating query. Please try rephrasing your question.",
                    PotentialIssues = new List<string> { "API communication error" }
                };
            }
            catch (JsonException ex)
            {
                // WHY: Handle malformed API responses gracefully
                _logger.LogError(ex, "Failed to parse API response");

                return new QueryResponse
                {
                    Confidence = 0,
                    Explanation = "Error processing API response. Please try again.",
                    PotentialIssues = new List<string> { "Response parsing error" }
                };
            }
        }

        public async Task<ValidationResult> ValidateQueryAsync(string sql)
        {
            // WHY: Server-side validation prevents SQL injection and dangerous operations
            // Never trust AI-generated content without validation
            var result = new ValidationResult
            {
                IsValid = true,
                SecurityRisk = SecurityRisk.Low
            };

            // HOW: Check for dangerous SQL operations
            var dangerousPatterns = new[]
            {
                "DROP TABLE", "DELETE FROM", "TRUNCATE", "ALTER TABLE",
                "CREATE TABLE", "INSERT INTO", "UPDATE SET", "EXEC ", "EXECUTE "
            };

            foreach (var pattern in dangerousPatterns)
            {
                if (sql.Contains(pattern, StringComparison.OrdinalIgnoreCase))
                {
                    result.Errors.Add(
                        $"Potentially dangerous operation detected: {pattern}");
                    result.SecurityRisk = SecurityRisk.Critical;
                    result.IsValid = false;
                }
            }

            // WHY: Performance validation prevents resource exhaustion
            if (sql.Contains("SELECT *", StringComparison.OrdinalIgnoreCase))
            {
                result.Warnings.Add(
                    "Consider specifying column names instead of SELECT * for better performance");

                // WHY: SELECT * can return excessive data and impact performance
                if (result.SecurityRisk < SecurityRisk.Medium)
                    result.SecurityRisk = SecurityRisk.Medium;
            }

            // WHY: Queries without limits can return massive datasets
            bool hasLimit = sql.Contains("LIMIT", StringComparison.OrdinalIgnoreCase) ||
                           sql.Contains("TOP ", StringComparison.OrdinalIgnoreCase);

            if (!hasLimit)
            {
                result.Warnings.Add(
                    "Query may return large result set. Consider adding LIMIT clause.");

                if (result.SecurityRisk < SecurityRisk.Medium)
                    result.SecurityRisk = SecurityRisk.Medium;
            }

            return await Task.FromResult(result);
        }

        public async Task<QueryResult> ExecuteQueryAsync(string sql)
        {
            // ⚠️ IMPORTANT: In production, connect to your actual database
            // This demo version simulates execution for safety

            // WHY: Simulate realistic database execution time
            await Task.Delay(Random.Shared.Next(500, 1500));

            // HOW: Return sample data matching the expected structure
            return new QueryResult
            {
                Success = true,
                Data = new List<Dictionary<string, object>>
                {
                    new()
                    {
                        ["Name"] = "Sample Data",
                        ["Value"] = 123,
                        ["Date"] = DateTime.Now
                    }
                },
                RowCount = 1,
                ExecutionTime = TimeSpan.FromMilliseconds(850)
            };
        }

        private QueryResponse AdjustConfidenceScore(QueryResponse response)
        {
            // WHY: Real-world experience shows Vanna AI overestimates confidence
            // for complex queries. This calibration improves accuracy.

            // HOW: Reduce confidence for queries with many table joins
            if (response.TablesUsed.Count > 5)
            {
                response.Confidence *= 0.8m;
                response.PotentialIssues.Add(
                    "Complex query involving multiple tables - verify join logic");
            }

            // HOW: Subqueries often introduce logical complexity
            if (response.Sql.Contains("SELECT", StringComparison.OrdinalIgnoreCase) &&
                response.Sql.IndexOf("SELECT", StringComparison.OrdinalIgnoreCase) !=
                response.Sql.LastIndexOf("SELECT", StringComparison.OrdinalIgnoreCase))
            {
                response.Confidence *= 0.9m;
                response.PotentialIssues.Add(
                    "Contains subqueries - verify logic carefully");
            }

            return response;
        }
    }
}
```

> 💡 **Tip**: The `AdjustConfidenceScore` method implements production lessons learned. In enterprise systems, calibrate these adjustments based on your specific database complexity and user query patterns.

> ⚠️ **Warning**: The `ExecuteQueryAsync` method contains a simulated implementation for safety. In production, you must implement proper database connectivity with parameterized queries and connection pooling.

## Advanced Scenarios

### Scenario 1: Building the Interactive Query Component

This scenario demonstrates building a complete user interface with real-time feedback and progressive disclosure of information.

**When you need this:**
- Users need immediate feedback as they type queries
- Applications require transparency in AI decision-making
- Complex workflows need step-by-step validation

**Implementation:**

```razor
@* FILE: Components/QueryInterface.razor *@
@* PURPOSE: Interactive text-to-SQL interface with real-time validation *@
@using VannaBlazorApp.Models
@using VannaBlazorApp.Services
@inject IVannaService VannaService
@inject IJSRuntime JSRuntime

<div class="query-interface">
    <div class="query-input-section">
        <div class="input-group">
            <label for="question" class="form-label">
                Ask your question in natural language:
            </label>

            @* WHY: Bind currentQuestion for two-way data flow *@
            @* HOW: onkeyup enables real-time validation feedback *@
            <textarea id="question"
                     class="form-control @GetInputClass()"
                     rows="3"
                     @bind="currentQuestion"
                     @onkeyup="OnQuestionChanged"
                     placeholder="e.g., Show me all users who logged in last week"
                     disabled="@isProcessing"></textarea>

            @if (!string.IsNullOrEmpty(validationMessage))
            {
                <div class="validation-feedback">@validationMessage</div>
            }
        </div>

        <div class="button-group">
            @* WHY: Disable button during processing to prevent duplicate requests *@
            <button class="btn btn-primary"
                    @onclick="GenerateQuery"
                    disabled="@(isProcessing || string.IsNullOrWhiteSpace(currentQuestion))">
                @if (isProcessing)
                {
                    <span class="spinner-border spinner-border-sm me-2"></span>
                    <text>Generating...</text>
                }
                else
                {
                    <text>Generate SQL</text>
                }
            </button>

            @* WHY: Show execution button only after successful query generation *@
            @* HOW: Disable if validation failed or query is invalid *@
            @if (queryResponse != null && !string.IsNullOrEmpty(queryResponse.Sql))
            {
                <button class="btn btn-success"
                        @onclick="ExecuteQuery"
                        disabled="@(isExecuting || !validationResult?.IsValid == true)">
                    @if (isExecuting)
                    {
                        <span class="spinner-border spinner-border-sm me-2"></span>
                        <text>Executing...</text>
                    }
                    else
                    {
                        <text>Execute Query</text>
                    }
                </button>
            }
        </div>
    </div>

    @* WHY: Progressive disclosure - show results only after generation *@
    @if (queryResponse != null)
    {
        <div class="query-response-section">
            @* HOW: Visual confidence indicator helps users assess query quality *@
            <div class="confidence-indicator">
                <div class="confidence-bar-container">
                    @* WHY: Width percentage visually represents confidence level *@
                    <div class="confidence-bar"
                         style="width: @(queryResponse.Confidence)%"></div>
                </div>
                <span class="confidence-text">
                    Confidence: @queryResponse.Confidence.ToString("F1")%
                    <span class="confidence-level @GetConfidenceClass()">
                        (@GetConfidenceLabel())
                    </span>
                </span>
            </div>

            @* HOW: Display generated SQL with syntax highlighting *@
            <div class="generated-sql">
                <h5>Generated SQL:</h5>
                <pre class="sql-code"><code>@queryResponse.Sql</code></pre>

                <div class="sql-actions">
                    <button class="btn btn-outline-secondary btn-sm"
                            @onclick="CopySqlToClipboard">
                        Copy SQL
                    </button>
                </div>
            </div>

            @* WHY: Explanation helps users understand query logic *@
            @if (!string.IsNullOrEmpty(queryResponse.Explanation))
            {
                <div class="explanation">
                    <h6>Explanation:</h6>
                    <p>@queryResponse.Explanation</p>
                </div>
            }

            @* WHY: Show which tables are accessed for transparency *@
            @if (queryResponse.TablesUsed.Any())
            {
                <div class="tables-used">
                    <h6>Tables Used:</h6>
                    <div class="table-tags">
                        @foreach (var table in queryResponse.TablesUsed)
                        {
                            <span class="badge bg-info">@table</span>
                        }
                    </div>
                </div>
            }

            @* HOW: Display validation results with visual severity indicators *@
            @if (validationResult != null)
            {
                <div class="validation-section">
                    <div class="security-risk @GetSecurityRiskClass()">
                        Security Risk: @validationResult.SecurityRisk
                    </div>

                    @if (validationResult.Warnings.Any())
                    {
                        <div class="warnings">
                            <h6>Warnings:</h6>
                            <ul>
                                @foreach (var warning in validationResult.Warnings)
                                {
                                    <li class="text-warning">@warning</li>
                                }
                            </ul>
                        </div>
                    }

                    @if (validationResult.Errors.Any())
                    {
                        <div class="errors">
                            <h6>Errors:</h6>
                            <ul>
                                @foreach (var error in validationResult.Errors)
                                {
                                    <li class="text-danger">@error</li>
                                }
                            </ul>
                        </div>
                    }
                </div>
            }

            @* WHY: Surface AI-identified concerns to users *@
            @if (queryResponse.PotentialIssues.Any())
            {
                <div class="potential-issues">
                    <h6>Potential Issues:</h6>
                    <ul>
                        @foreach (var issue in queryResponse.PotentialIssues)
                        {
                            <li class="text-warning">@issue</li>
                        }
                    </ul>
                </div>
            }
        </div>
    }

    @* WHY: Show results only after successful execution *@
    @if (queryResult != null)
    {
        <div class="query-results-section">
            @if (queryResult.Success)
            {
                <div class="results-header">
                    <h5>Query Results</h5>
                    <div class="results-meta">
                        @* HOW: Display performance metrics for transparency *@
                        <span class="badge bg-success">@queryResult.RowCount rows</span>
                        <span class="badge bg-info">
                            @queryResult.ExecutionTime.TotalMilliseconds ms
                        </span>
                    </div>
                </div>

                @* HOW: Dynamically render results as a table *@
                @if (queryResult.Data.Any())
                {
                    <div class="table-responsive">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    @* WHY: Use first row to determine column structure *@
                                    @foreach (var column in queryResult.Data.First().Keys)
                                    {
                                        <th>@column</th>
                                    }
                                </tr>
                            </thead>
                            <tbody>
                                @foreach (var row in queryResult.Data)
                                {
                                    <tr>
                                        @foreach (var value in row.Values)
                                        {
                                            <td>@value</td>
                                        }
                                    </tr>
                                }
                            </tbody>
                        </table>
                    </div>
                }
            }
            else
            {
                <div class="alert alert-danger">
                    <strong>Execution Error:</strong> @queryResult.ErrorMessage
                </div>
            }
        </div>
    }
</div>

@code {
    // Component state management
    private string currentQuestion = string.Empty;
    private string validationMessage = string.Empty;
    private bool isProcessing = false;
    private bool isExecuting = false;

    private QueryResponse? queryResponse;
    private ValidationResult? validationResult;
    private QueryResult? queryResult;

    private async Task OnQuestionChanged(KeyboardEventArgs e)
    {
        // WHY: Provide immediate feedback without waiting for submission
        // HOW: Validate input length and content as user types

        if (string.IsNullOrWhiteSpace(currentQuestion))
        {
            validationMessage = "Please enter a question";
            return;
        }

        if (currentQuestion.Length < 10)
        {
            validationMessage = "Please provide more detail in your question";
            return;
        }

        validationMessage = string.Empty;
    }

    private async Task GenerateQuery()
    {
        if (string.IsNullOrWhiteSpace(currentQuestion)) return;

        // WHY: Clear previous results to avoid confusion
        isProcessing = true;
        queryResponse = null;
        validationResult = null;
        queryResult = null;

        try
        {
            var request = new QueryRequest
            {
                Question = currentQuestion,
                DatabaseSchema = "default" // In production, use actual schema
            };

            // HOW: Generate query via Vanna AI service
            queryResponse = await VannaService.GenerateQueryAsync(request);

            // WHY: Validate immediately after generation, before showing to user
            if (!string.IsNullOrEmpty(queryResponse.Sql))
            {
                validationResult = await VannaService.ValidateQueryAsync(
                    queryResponse.Sql);
            }
        }
        catch (Exception ex)
        {
            // WHY: Graceful error handling prevents application crashes
            queryResponse = new QueryResponse
            {
                Explanation = "An error occurred while generating the query. Please try again.",
                Confidence = 0
            };
        }
        finally
        {
            isProcessing = false;
            StateHasChanged(); // Trigger UI update
        }
    }

    private async Task ExecuteQuery()
    {
        if (queryResponse == null || string.IsNullOrEmpty(queryResponse.Sql))
            return;

        isExecuting = true;

        try
        {
            // HOW: Execute validated query via service layer
            queryResult = await VannaService.ExecuteQueryAsync(queryResponse.Sql);
        }
        catch (Exception ex)
        {
            // WHY: Provide specific error information to users
            queryResult = new QueryResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
        finally
        {
            isExecuting = false;
            StateHasChanged();
        }
    }

    private async Task CopySqlToClipboard()
    {
        // WHY: Enable users to use generated SQL in other tools
        if (queryResponse != null && !string.IsNullOrEmpty(queryResponse.Sql))
        {
            await JSRuntime.InvokeVoidAsync(
                "navigator.clipboard.writeText",
                queryResponse.Sql);
        }
    }

    // Helper methods for CSS class assignment
    private string GetInputClass()
    {
        return string.IsNullOrEmpty(validationMessage) ? "" : "is-invalid";
    }

    private string GetConfidenceClass()
    {
        if (queryResponse == null) return "";
        return queryResponse.Confidence switch
        {
            >= 80 => "confidence-high",
            >= 60 => "confidence-medium",
            _ => "confidence-low"
        };
    }

    private string GetConfidenceLabel()
    {
        if (queryResponse == null) return "";
        return queryResponse.Confidence switch
        {
            >= 80 => "High",
            >= 60 => "Medium",
            _ => "Low"
        };
    }

    private string GetSecurityRiskClass()
    {
        if (validationResult == null) return "";
        return validationResult.SecurityRisk switch
        {
            SecurityRisk.Low => "security-low",
            SecurityRisk.Medium => "security-medium",
            SecurityRisk.High => "security-high",
            SecurityRisk.Critical => "security-critical",
            _ => ""
        };
    }
}
```

> 💡 **Tip**: The `StateHasChanged()` calls ensure the UI updates after async operations complete. In Blazor Server, this triggers a SignalR message to update the client's DOM.

**Comparison with Alternative Approaches:**

| Aspect | Real-time Validation | Post-submit Validation |
|--------|---------------------|----------------------|
| User Experience | Immediate feedback | Faster initial render |
| Server Load | Higher (more requests) | Lower (fewer requests) |
| Complexity | More complex state management | Simpler implementation |
| Best For | Interactive applications | High-traffic scenarios |

### Scenario 2: Adding Visual Feedback with CSS

Implement the styling layer that makes validation states and confidence levels immediately visible:

```css
/* FILE: wwwroot/css/vanna-interface.css */
/* PURPOSE: Visual feedback for text-to-SQL interface */

.query-interface {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.query-input-section {
    margin-bottom: 30px;
}

.input-group {
    margin-bottom: 15px;
}

.button-group {
    display: flex;
    gap: 10px;
}

/* WHY: Visual confidence indicator helps users quickly assess query quality */
.confidence-indicator {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 20px;
}

.confidence-bar-container {
    width: 100%;
    height: 8px;
    background-color: #e9ecef;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
}

/* HOW: Gradient represents confidence range visually */
/* Red (low) -> Yellow (medium) -> Green (high) */
.confidence-bar {
    height: 100%;
    background: linear-gradient(90deg, #dc3545 0%, #ffc107 50%, #28a745 100%);
    transition: width 0.3s ease;
}

/* Confidence level color coding */
.confidence-high {
    color: #28a745;
    font-weight: 600;
}

.confidence-medium {
    color: #ffc107;
    font-weight: 600;
}

.confidence-low {
    color: #dc3545;
    font-weight: 600;
}

/* Security risk color coding */
.security-low {
    color: #28a745;
    padding: 10px;
    border-left: 4px solid #28a745;
}

.security-medium {
    color: #ffc107;
    padding: 10px;
    border-left: 4px solid #ffc107;
}

.security-high {
    color: #fd7e14;
    padding: 10px;
    border-left: 4px solid #fd7e14;
}

.security-critical {
    color: #dc3545;
    font-weight: bold;
    padding: 10px;
    border-left: 4px solid #dc3545;
    background: #f8d7da;
}

.generated-sql {
    margin-bottom: 20px;
}

/* WHY: Monospace font improves SQL readability */
.sql-code {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    padding: 15px;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    white-space: pre-wrap;
    word-break: break-all;
}

.table-tags .badge {
    margin-right: 5px;
    margin-bottom: 5px;
}

/* WHY: Highlighted background draws attention to validation issues */
.validation-section {
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 4px;
    padding: 15px;
    margin-bottom: 20px;
}

.results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
}

.results-meta .badge {
    margin-left: 10px;
}

/* HOW: Responsive design for mobile devices */
@media (max-width: 768px) {
    .button-group {
        flex-direction: column;
    }

    .results-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .results-meta {
        margin-top: 10px;
    }
}
```

> ℹ️ **Note**: The gradient in `.confidence-bar` provides instant visual feedback. Users can assess query quality at a glance without reading the numeric confidence value.

### Scenario 3: Service Registration and Configuration

Configure dependency injection and application startup:

```csharp
// FILE: Program.cs
// PURPOSE: Configure application services and middleware
using VannaBlazorApp.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor();

// WHY: HttpClientFactory provides connection pooling and lifetime management
// HOW: Typed client registration associates HttpClient with VannaService
builder.Services.AddHttpClient<IVannaService, VannaService>();

// WHY: Scoped lifetime ensures one instance per user circuit in Blazor Server
builder.Services.AddScoped<IVannaService, VannaService>();

var app = builder.Build();

// Configure the HTTP request pipeline
if (!app.Environment.IsDevelopment())
{
    // WHY: Production error handling prevents sensitive information disclosure
    app.UseExceptionHandler("/Error");

    // WHY: HSTS enforces secure connections
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();

app.MapRazorPages();
app.MapBlazorHub();
app.MapFallbackToPage("/_Host");

app.Run();
```

**Configuration file structure:**

```json
// FILE: appsettings.json
// PURPOSE: Configure Vanna AI connection settings
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "VannaBlazorApp.Services": "Debug"
    }
  },
  "VannaAI": {
    "BaseUrl": "https://api.vanna.ai/",
    "ApiKey": "your-api-key-here"
  }
}
```

> ⚠️ **Warning**: Never commit API keys to source control. Use environment variables or Azure Key Vault for production deployments.

> 💡 **Tip**: Set the `VannaBlazorApp.Services` log level to `Debug` during development to see detailed API communication logs.

## Production Considerations

### Security

**API Key Management:**
```csharp
// ❌ NEVER hardcode API keys
var apiKey = "sk-1234567890abcdef";

// ✅ Use configuration with environment variable override
var apiKey = builder.Configuration["VannaAI:ApiKey"]
    ?? Environment.GetEnvironmentVariable("VANNA_API_KEY");
```

**SQL Injection Prevention:**
- Always validate generated SQL before execution
- Use parameterized queries for user-supplied values
- Implement query whitelisting for sensitive environments
- Log all executed queries for audit trails

**Rate Limiting:**
```csharp
// Implement rate limiting to prevent API abuse
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("api", opt =>
    {
        opt.PermitLimit = 10;
        opt.Window = TimeSpan.FromMinutes(1);
    });
});
```

### Performance

**Caching Strategies:**
```csharp
public class CachedVannaService : IVannaService
{
    private readonly IMemoryCache _cache;
    private readonly IVannaService _innerService;

    // WHY: Cache frequently requested queries to reduce API calls
    public async Task<QueryResponse> GenerateQueryAsync(QueryRequest request)
    {
        var cacheKey = $"query_{request.Question}";

        if (_cache.TryGetValue(cacheKey, out QueryResponse? cached))
            return cached!;

        var response = await _innerService.GenerateQueryAsync(request);

        // Cache for 1 hour
        _cache.Set(cacheKey, response, TimeSpan.FromHours(1));

        return response;
    }
}
```

**Connection Pooling:**
- `HttpClientFactory` provides automatic connection pooling
- Configure timeout values based on API response times
- Monitor connection metrics in production

**Performance Metrics:**

In production deployments, you can expect:
- Query generation: 500-2000ms (depends on complexity)
- Validation: 10-50ms (server-side)
- UI render: 100-300ms (Blazor Server)
- Total user experience: 1-3 seconds for complete flow

### Monitoring

**Application Insights Integration:**
```csharp
builder.Services.AddApplicationInsightsTelemetry();

// Custom telemetry for Vanna AI operations
public class VannaService : IVannaService
{
    private readonly TelemetryClient _telemetry;

    public async Task<QueryResponse> GenerateQueryAsync(QueryRequest request)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            var response = await GenerateQueryInternalAsync(request);

            _telemetry.TrackMetric("VannaAI.QueryGeneration.Duration",
                stopwatch.ElapsedMilliseconds);
            _telemetry.TrackMetric("VannaAI.QueryGeneration.Confidence",
                (double)response.Confidence);

            return response;
        }
        catch (Exception ex)
        {
            _telemetry.TrackException(ex);
            throw;
        }
    }
}
```

**Key metrics to track:**
- Query generation success rate
- Average confidence scores
- Validation failure rate by type
- API response times
- Error rates and types

> 💡 **Tip**: Set up alerts for confidence scores below 60% or validation failure rates above 10%. These indicate potential training data issues or user confusion.

## Troubleshooting

### Issue: "JavaScript interop calls cannot be issued at this time"

**Symptoms:**
- Error occurs when copying SQL to clipboard
- Only happens during server-side prerendering
- Application crashes or shows error page

**Cause:**
JavaScript interop isn't available during server-side prerendering in Blazor Server.

**Solution:**
```csharp
private async Task CopySqlToClipboard()
{
    // Check if JavaScript runtime is available
    if (JSRuntime is IJSInProcessRuntime)
    {
        await JSRuntime.InvokeVoidAsync("navigator.clipboard.writeText",
            queryResponse.Sql);
    }
    else
    {
        // Fallback: Show message or use alternative approach
        // During prerender, defer this operation until after render
    }
}
```

### Issue: Vanna AI Returns Low Confidence for Valid Queries

**Symptoms:**
- Confidence scores consistently below 70%
- Queries appear correct but flagged as uncertain
- Users lose trust in the system

**Cause:**
Vanna AI needs training on your specific database schema and query patterns.

**Solution:**
1. Provide more training examples to Vanna AI
2. Adjust confidence thresholds based on your environment
3. Implement feedback loop for users to rate query accuracy
4. Review and improve database schema documentation

```csharp
// Adjust confidence thresholds for your environment
private string GetConfidenceLabel()
{
    // Lower thresholds if Vanna AI is well-trained on your schema
    return queryResponse.Confidence switch
    {
        >= 70 => "High",    // Adjusted from 80
        >= 50 => "Medium",  // Adjusted from 60
        _ => "Low"
    };
}
```

### Issue: Validation Blocks All Multi-Table Queries

**Symptoms:**
- Queries with JOINs fail validation
- Business-critical queries are blocked
- Users bypass the interface

**Cause:**
Validation rules are too strict for legitimate use cases.

**Solution:**
```csharp
public async Task<ValidationResult> ValidateQueryAsync(string sql)
{
    var result = new ValidationResult { IsValid = true };

    // WHY: Allow JOINs but flag excessive complexity
    int joinCount = Regex.Matches(sql, @"\bJOIN\b",
        RegexOptions.IgnoreCase).Count;

    if (joinCount > 10)
    {
        result.Warnings.Add(
            $"Query contains {joinCount} JOINs. Consider breaking into smaller queries.");
        result.SecurityRisk = SecurityRisk.Medium;
    }

    return result;
}
```

### Issue: High API Costs from Vanna AI

**Symptoms:**
- Unexpectedly high Vanna AI usage
- Same queries generated repeatedly
- API rate limits reached

**Cause:**
Missing caching layer for frequently requested queries.

**Solution:**
Implement query caching as shown in the Performance section above.

## FAQ: Blazor + Vanna Integration

### Q: Can I use this with Blazor WebAssembly instead of Blazor Server?

Yes, but you'll need to modify the architecture. Blazor WebAssembly can't make direct API calls to Vanna AI (CORS restrictions). You'll need:

1. Create an ASP.NET Core API backend
2. Move VannaService to the API project
3. Have Blazor WASM call your API instead of Vanna directly
4. Implement authentication between Blazor and your API

### Q: How do I handle different database schemas for different users?

Implement tenant-based schema selection:

```csharp
public class TenantAwareVannaService : IVannaService
{
    private readonly IHttpContextAccessor _httpContext;

    public async Task<QueryResponse> GenerateQueryAsync(QueryRequest request)
    {
        // Get user's tenant from claims
        var tenantId = _httpContext.HttpContext?.User
            .FindFirst("TenantId")?.Value;

        // Load tenant-specific schema
        request.DatabaseSchema = await GetSchemaForTenant(tenantId);

        return await _innerService.GenerateQueryAsync(request);
    }
}
```

### Q: What happens if the Vanna AI API is unavailable?

Implement circuit breaker pattern for resilience:

```csharp
builder.Services.AddHttpClient<IVannaService, VannaService>()
    .AddPolicyHandler(Policy
        .Handle<HttpRequestException>()
        .CircuitBreakerAsync(
            handledEventsAllowedBeforeBreaking: 3,
            durationOfBreak: TimeSpan.FromMinutes(1)));
```

This prevents cascading failures and provides graceful degradation.

### Q: Can I customize the confidence score calculation?

Yes, the `AdjustConfidenceScore` method is designed for customization. Add your own rules based on:
- Query complexity metrics
- Historical accuracy data
- User feedback loops
- Domain-specific patterns

### Q: How do I implement query approval workflows for sensitive data?

Add an approval layer before execution:

```csharp
public class ApprovalWorkflowService
{
    public async Task<bool> RequiresApproval(QueryResponse query)
    {
        // Check if query accesses sensitive tables
        var sensitiveTables = new[] { "Salaries", "SSN", "Medical" };
        return query.TablesUsed.Any(t =>
            sensitiveTables.Contains(t, StringComparer.OrdinalIgnoreCase));
    }

    public async Task SubmitForApproval(QueryResponse query, string userId)
    {
        // Store in approval queue
        // Send notification to approvers
        // Return approval request ID
    }
}
```

## Next Steps

Now that you understand the fundamentals of integrating Blazor with Vanna AI, you can:

- [ ] Set up your development environment with the prerequisites
- [ ] Implement the basic query interface
- [ ] Add custom validation rules for your database
- [ ] Configure production security settings
- [ ] Set up monitoring and telemetry
- [ ] Implement caching for frequently used queries
- [ ] Create approval workflows for sensitive queries

**Further Reading:**
- [Blazor Server Authentication](https://docs.microsoft.com/aspnet/core/blazor/security/server)
- [Vanna AI Documentation](https://vanna.ai/docs)
- [Building Production-Ready Blazor Applications](https://ljblab.dev/tags/blazor)

**Need Help?**

Implementing text-to-SQL for an enterprise or government system? I've built these systems for federal agencies with strict compliance requirements. [Schedule a consultation](https://ljblab.dev/contact) to discuss your specific needs, including:
- Multi-tenant architecture design
- Compliance requirements (FedRAMP, FISMA)
- Custom validation and approval workflows
- Training Vanna AI on your database schema
- Performance optimization at scale

The architecture shown here represents patterns successfully used in federal systems where every query needs to be traceable, verifiable, and auditable. The key insight is that AI assistance becomes more valuable when users understand and can verify its recommendations, building trust through transparency rather than black-box automation.
