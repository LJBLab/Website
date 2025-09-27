---
publishDate: 2024-12-03T09:00:00Z
title: 'Building a Blazor + Vanna AI Application: Real-Time Text-to-SQL Interface'
excerpt: Learn how to integrate Vanna AI with Blazor Server to create a powerful text-to-SQL interface. This comprehensive guide covers component design, API integration, and real-time validation with confidence scoring.
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
---

After implementing text-to-SQL systems across multiple government databases, I've learned that the key to successful AI-powered query interfaces isn't just the AI model—it's building trust through transparency. When a compliance officer needs to understand how their natural language query became a SQL statement affecting thousands of records, confidence scores and validation workflows become critical.

In this three-part series, I'll show you how to build a production-ready Blazor application that integrates with Vanna AI for text-to-SQL functionality. This isn't just about getting AI to generate queries—it's about creating a system that government auditors and enterprise stakeholders can trust.

## Understanding the Challenge

Traditional database interfaces force users to know SQL syntax, table structures, and complex join relationships. Meanwhile, AI-powered solutions often feel like black boxes that generate queries without transparency. The solution lies in building an interface that bridges both worlds.

In my experience with federal database systems, I've seen two common failure patterns:

1. **Over-reliance on AI**: Systems that blindly execute generated queries without user verification
2. **Under-utilization of AI**: Interfaces that require so much manual validation that users abandon the AI features

The sweet spot is a system that leverages AI capabilities while providing clear confidence indicators and validation workflows.

## Setting Up the Blazor Foundation

Let's start by creating a Blazor Server application with the necessary components for Vanna AI integration. Here's the project structure I've found most effective:

```bash
dotnet new blazorserver -n VannaBlazorApp
cd VannaBlazorApp
dotnet add package Microsoft.Extensions.Http
dotnet add package System.Text.Json
```

First, let's create our data models that will handle the Vanna AI responses:

```csharp
// Models/VannaModels.cs
using System.Text.Json.Serialization;

namespace VannaBlazorApp.Models
{
    public class QueryRequest
    {
        public string Question { get; set; } = string.Empty;
        public string DatabaseSchema { get; set; } = string.Empty;
    }

    public class QueryResponse
    {
        [JsonPropertyName("sql")]
        public string Sql { get; set; } = string.Empty;

        [JsonPropertyName("confidence")]
        public decimal Confidence { get; set; }

        [JsonPropertyName("explanation")]
        public string Explanation { get; set; } = string.Empty;

        [JsonPropertyName("tables_used")]
        public List<string> TablesUsed { get; set; } = new();

        [JsonPropertyName("potential_issues")]
        public List<string> PotentialIssues { get; set; } = new();
    }

    public class QueryResult
    {
        public bool Success { get; set; }
        public string ErrorMessage { get; set; } = string.Empty;
        public List<Dictionary<string, object>> Data { get; set; } = new();
        public int RowCount { get; set; }
        public TimeSpan ExecutionTime { get; set; }
    }

    public class ValidationResult
    {
        public bool IsValid { get; set; }
        public List<string> Warnings { get; set; } = new();
        public List<string> Errors { get; set; } = new();
        public SecurityRisk SecurityRisk { get; set; }
    }

    public enum SecurityRisk
    {
        Low,
        Medium,
        High,
        Critical
    }
}
```

## Creating the Vanna AI Service Layer

The service layer handles all communication with Vanna AI and provides the validation logic that government systems require:

```csharp
// Services/VannaService.cs
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

        public VannaService(HttpClient httpClient, ILogger<VannaService> logger, IConfiguration configuration)
        {
            _httpClient = httpClient;
            _logger = logger;
            _configuration = configuration;

            // Configure base URL and headers for Vanna AI API
            _httpClient.BaseAddress = new Uri(_configuration["VannaAI:BaseUrl"] ?? "https://api.vanna.ai/");
            _httpClient.DefaultRequestHeaders.Add("Authorization",
                $"Bearer {_configuration["VannaAI:ApiKey"]}");
        }

        public async Task<QueryResponse> GenerateQueryAsync(QueryRequest request)
        {
            try
            {
                var jsonContent = JsonSerializer.Serialize(request);
                var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync("generate-sql", content);
                response.EnsureSuccessStatusCode();

                var responseJson = await response.Content.ReadAsStringAsync();
                var queryResponse = JsonSerializer.Deserialize<QueryResponse>(responseJson);

                // Add our own confidence adjustments based on real-world patterns
                queryResponse = AdjustConfidenceScore(queryResponse);

                _logger.LogInformation("Generated query with confidence: {Confidence}",
                    queryResponse?.Confidence);

                return queryResponse ?? new QueryResponse();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating query for: {Question}", request.Question);
                return new QueryResponse
                {
                    Sql = "",
                    Confidence = 0,
                    Explanation = "Error generating query. Please try rephrasing your question.",
                    PotentialIssues = new List<string> { "API communication error" }
                };
            }
        }

        public async Task<ValidationResult> ValidateQueryAsync(string sql)
        {
            // This is where production systems need robust validation
            var result = new ValidationResult { IsValid = true };

            // Check for common SQL injection patterns
            var dangerousPatterns = new[]
            {
                "DROP TABLE", "DELETE FROM", "TRUNCATE", "ALTER TABLE",
                "CREATE TABLE", "INSERT INTO", "UPDATE SET"
            };

            foreach (var pattern in dangerousPatterns)
            {
                if (sql.ToUpperInvariant().Contains(pattern))
                {
                    result.Errors.Add($"Potentially dangerous operation detected: {pattern}");
                    result.SecurityRisk = SecurityRisk.High;
                    result.IsValid = false;
                }
            }

            // Check for performance concerns
            if (sql.ToUpperInvariant().Contains("SELECT *"))
            {
                result.Warnings.Add("Consider specifying column names instead of SELECT *");
            }

            if (!sql.ToUpperInvariant().Contains("LIMIT") && !sql.ToUpperInvariant().Contains("TOP"))
            {
                result.Warnings.Add("Query may return large result set. Consider adding LIMIT clause.");
                result.SecurityRisk = SecurityRisk.Medium;
            }

            return await Task.FromResult(result);
        }

        public async Task<QueryResult> ExecuteQueryAsync(string sql)
        {
            // In production, this would connect to your actual database
            // For this demo, we'll simulate execution

            await Task.Delay(1000); // Simulate database execution time

            return new QueryResult
            {
                Success = true,
                Data = new List<Dictionary<string, object>>
                {
                    new() { ["Name"] = "Sample Data", ["Value"] = 123, ["Date"] = DateTime.Now }
                },
                RowCount = 1,
                ExecutionTime = TimeSpan.FromMilliseconds(850)
            };
        }

        private QueryResponse AdjustConfidenceScore(QueryResponse response)
        {
            // Based on real-world experience, adjust confidence scores
            if (response.TablesUsed.Count > 5)
            {
                response.Confidence *= 0.8m; // Complex joins reduce confidence
                response.PotentialIssues.Add("Complex query involving multiple tables");
            }

            if (response.Sql.ToUpperInvariant().Contains("SUBQUERY"))
            {
                response.Confidence *= 0.9m;
                response.PotentialIssues.Add("Contains subqueries - verify logic carefully");
            }

            return response;
        }
    }
}
```

## Building the Query Interface Component

Now let's create the main component that users will interact with. This component needs to handle real-time feedback and confidence indicators:

```razor
@* Components/QueryInterface.razor *@
@using VannaBlazorApp.Models
@using VannaBlazorApp.Services
@inject IVannaService VannaService
@inject IJSRuntime JSRuntime

<div class="query-interface">
    <div class="query-input-section">
        <div class="input-group">
            <label for="question" class="form-label">Ask your question in natural language:</label>
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

    @if (queryResponse != null)
    {
        <div class="query-response-section">
            <div class="confidence-indicator">
                <div class="confidence-bar-container">
                    <div class="confidence-bar" style="width: @(queryResponse.Confidence)%"></div>
                </div>
                <span class="confidence-text">
                    Confidence: @queryResponse.Confidence.ToString("F1")%
                    <span class="confidence-level @GetConfidenceClass()">
                        (@GetConfidenceLabel())
                    </span>
                </span>
            </div>

            <div class="generated-sql">
                <h5>Generated SQL:</h5>
                <pre class="sql-code"><code>@queryResponse.Sql</code></pre>

                <div class="sql-actions">
                    <button class="btn btn-outline-secondary btn-sm" @onclick="CopySqlToClipboard">
                        Copy SQL
                    </button>
                </div>
            </div>

            @if (!string.IsNullOrEmpty(queryResponse.Explanation))
            {
                <div class="explanation">
                    <h6>Explanation:</h6>
                    <p>@queryResponse.Explanation</p>
                </div>
            }

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

    @if (queryResult != null)
    {
        <div class="query-results-section">
            @if (queryResult.Success)
            {
                <div class="results-header">
                    <h5>Query Results</h5>
                    <div class="results-meta">
                        <span class="badge bg-success">@queryResult.RowCount rows</span>
                        <span class="badge bg-info">@queryResult.ExecutionTime.TotalMilliseconds ms</span>
                    </div>
                </div>

                @if (queryResult.Data.Any())
                {
                    <div class="table-responsive">
                        <table class="table table-striped">
                            <thead>
                                <tr>
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
    private string currentQuestion = string.Empty;
    private string validationMessage = string.Empty;
    private bool isProcessing = false;
    private bool isExecuting = false;

    private QueryResponse? queryResponse;
    private ValidationResult? validationResult;
    private QueryResult? queryResult;

    protected override void OnInitialized()
    {
        // Initialize component state
    }

    private async Task OnQuestionChanged(KeyboardEventArgs e)
    {
        // Real-time validation feedback
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

        isProcessing = true;
        queryResponse = null;
        validationResult = null;
        queryResult = null;

        try
        {
            var request = new QueryRequest
            {
                Question = currentQuestion,
                DatabaseSchema = "default" // In production, this would be dynamic
            };

            queryResponse = await VannaService.GenerateQueryAsync(request);

            if (!string.IsNullOrEmpty(queryResponse.Sql))
            {
                validationResult = await VannaService.ValidateQueryAsync(queryResponse.Sql);
            }
        }
        catch (Exception ex)
        {
            // Handle errors appropriately
            queryResponse = new QueryResponse
            {
                Explanation = "An error occurred while generating the query. Please try again.",
                Confidence = 0
            };
        }
        finally
        {
            isProcessing = false;
            StateHasChanged();
        }
    }

    private async Task ExecuteQuery()
    {
        if (queryResponse == null || string.IsNullOrEmpty(queryResponse.Sql)) return;

        isExecuting = true;

        try
        {
            queryResult = await VannaService.ExecuteQueryAsync(queryResponse.Sql);
        }
        finally
        {
            isExecuting = false;
            StateHasChanged();
        }
    }

    private async Task CopySqlToClipboard()
    {
        if (queryResponse != null && !string.IsNullOrEmpty(queryResponse.Sql))
        {
            await JSRuntime.InvokeVoidAsync("navigator.clipboard.writeText", queryResponse.Sql);
        }
    }

    private string GetInputClass()
    {
        if (string.IsNullOrEmpty(validationMessage)) return "";
        return "is-invalid";
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

## Adding the Required CSS

To make our interface visually appealing and functional, we need appropriate styling:

```css
/* wwwroot/css/vanna-interface.css */
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

.confidence-bar {
    height: 100%;
    background: linear-gradient(90deg, #dc3545 0%, #ffc107 50%, #28a745 100%);
    transition: width 0.3s ease;
}

.confidence-high { color: #28a745; }
.confidence-medium { color: #ffc107; }
.confidence-low { color: #dc3545; }

.security-low { color: #28a745; }
.security-medium { color: #ffc107; }
.security-high { color: #fd7e14; }
.security-critical { color: #dc3545; font-weight: bold; }

.generated-sql {
    margin-bottom: 20px;
}

.sql-code {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    padding: 15px;
    font-family: 'Courier New', monospace;
    white-space: pre-wrap;
    word-break: break-all;
}

.table-tags .badge {
    margin-right: 5px;
    margin-bottom: 5px;
}

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

## Registering Services and Configuration

Finally, update your Program.cs to register the services:

```csharp
// Program.cs
using VannaBlazorApp.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor();

// Register HTTP client and Vanna service
builder.Services.AddHttpClient<IVannaService, VannaService>();
builder.Services.AddScoped<IVannaService, VannaService>();

var app = builder.Build();

// Configure the HTTP request pipeline
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
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

## Key Takeaways

This foundation provides several critical features for production text-to-SQL systems:

1. **Confidence Transparency**: Users see exactly how confident the AI is in its generated query
2. **Real-time Validation**: Security and performance concerns are flagged immediately
3. **Progressive Disclosure**: Complex information is revealed appropriately as users interact
4. **Error Handling**: Graceful degradation when AI services are unavailable

In the next part of this series, we'll add advanced security features including role-based access controls, query approval workflows, and comprehensive audit logging—essential features for government and enterprise deployments.

The code shown here represents patterns I've successfully used in federal systems where every query needs to be traceable and verifiable. The key insight is that AI assistance becomes more valuable when users understand and can verify its recommendations.

Remember: Vanna AI is a powerful tool, but in production systems, human oversight and validation remain essential. This interface design encourages that verification while making the AI capabilities easily accessible.