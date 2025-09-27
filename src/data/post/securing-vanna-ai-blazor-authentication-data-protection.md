---
title: "Securing Vanna AI in Blazor: Authentication and Data Protection"
description: "Learn how to implement robust security controls for AI-powered SQL query systems in Blazor applications, including authentication, data protection, and compliance audit logging."
publishDate: 2024-12-10T00:00:00.000Z
excerpt: "After managing 10+ federal systems with AI components, I've learned that securing AI-powered database queries requires more than just authentication. Here's how to implement comprehensive security controls that protect sensitive data while maintaining the power of natural language queries."
image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
tags:
  - blazor
  - vanna-ai
  - security
  - authentication
  - data-protection
  - enterprise
category: "AI Development"
author: "Lincoln J Bicalho"
---

After implementing the Vanna AI interface we built in [Part 1](/blog/blazor-vanna-ai-natural-language-sql-queries), I faced a sobering realization during our first security audit. The auditor's question was simple but devastating: "So anyone can ask your AI to query any data in your database?"

That 3 AM security review changed everything. What started as an impressive demo of natural language database queries had become a potential data breach waiting to happen. In government and enterprise environments, AI-powered query systems require security controls that go far beyond traditional database access patterns.

Here's what I learned about securing AI database interactions in production environments, and the comprehensive security framework we implemented to pass FedRAMP compliance audits.

## Understanding the Security Challenge

AI-powered database queries introduce unique security challenges that traditional SQL interfaces don't face. When users can describe what they want in natural language, the system must make intelligent decisions about what data to expose, how to filter sensitive information, and whether the user has appropriate permissions.

The core problem is that AI systems are inherently unpredictable. While Vanna AI generally generates appropriate SQL queries, there's no guarantee that a user won't craft a prompt that tricks the AI into exposing data they shouldn't see. Traditional role-based access control (RBAC) assumes predictable query patterns, but natural language input creates infinite possibilities.

In our federal systems, this meant implementing a multi-layered security approach:

- **Authentication**: Who can use the AI query system
- **Authorization**: What data sources they can query
- **Data Classification**: Which fields contain sensitive information
- **Query Validation**: Ensuring generated SQL respects security boundaries
- **Audit Logging**: Complete trails for compliance reviews
- **Rate Limiting**: Preventing abuse and excessive API usage

The solution required building security controls at every layer of the application stack.

## Implementing JWT Authentication

Starting with the foundation, we need to secure who can access our Vanna AI interface. Building on our components from Part 1, here's the authentication service implementation:

```csharp
// Services/VannaAuthenticationService.cs
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

public class VannaAuthenticationService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<VannaAuthenticationService> _logger;

    public VannaAuthenticationService(
        IConfiguration configuration,
        ILogger<VannaAuthenticationService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<AuthenticationResult> AuthenticateUserAsync(string username, string password)
    {
        // In production, validate against your identity provider
        var user = await ValidateUserCredentialsAsync(username, password);
        if (user == null)
        {
            _logger.LogWarning("Authentication failed for user: {Username}", username);
            return AuthenticationResult.Failed("Invalid credentials");
        }

        var token = GenerateJwtToken(user);
        var refreshToken = GenerateRefreshToken();

        // Store refresh token securely
        await StoreRefreshTokenAsync(user.Id, refreshToken);

        _logger.LogInformation("User authenticated successfully: {Username}", username);

        return AuthenticationResult.Success(token, refreshToken, user);
    }

    private string GenerateJwtToken(UserInfo user)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_configuration["Jwt:SecretKey"]));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim("data_access_level", user.DataAccessLevel.ToString()),
            new Claim("department", user.Department),
            new Claim("vanna_permissions", string.Join(",", user.VannaPermissions))
        };

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8), // Shorter expiry for AI systems
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private async Task<UserInfo> ValidateUserCredentialsAsync(string username, string password)
    {
        // Integration with your authentication system
        // This could be Active Directory, Azure AD, or custom user store
        // Never store passwords in plain text

        try
        {
            // Example integration with enterprise identity provider
            var user = await _userRepository.GetUserByUsernameAsync(username);
            if (user != null && await VerifyPasswordAsync(user, password))
            {
                return user;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating user credentials for: {Username}", username);
        }

        return null;
    }
}

public class AuthenticationResult
{
    public bool IsSuccess { get; set; }
    public string Token { get; set; }
    public string RefreshToken { get; set; }
    public UserInfo User { get; set; }
    public string ErrorMessage { get; set; }

    public static AuthenticationResult Success(string token, string refreshToken, UserInfo user)
        => new() { IsSuccess = true, Token = token, RefreshToken = refreshToken, User = user };

    public static AuthenticationResult Failed(string error)
        => new() { IsSuccess = false, ErrorMessage = error };
}
```

Now we'll secure our Blazor components with role-based access:

```razor
@* Components/SecureVannaQueryInterface.razor *@
@using Microsoft.AspNetCore.Authorization
@using Microsoft.AspNetCore.Components.Authorization
@attribute [Authorize]
@inject AuthenticationStateProvider AuthStateProvider
@inject VannaSecurityService SecurityService
@inject IJSRuntime JSRuntime

<CascadingAuthenticationState>
    <AuthorizeView>
        <Authorized>
            @if (userPermissions?.CanUseVannaAI == true)
            {
                <div class="vanna-interface-container">
                    <div class="security-header">
                        <div class="user-info">
                            <span class="user-name">@context.User.Identity.Name</span>
                            <span class="access-level">@userPermissions.DataAccessLevel</span>
                        </div>
                        <div class="session-info">
                            <span>Session expires: @sessionExpiry.ToString("HH:mm")</span>
                        </div>
                    </div>

                    <VannaQueryComponent
                        UserPermissions="@userPermissions"
                        OnQueryExecuted="@HandleQueryExecuted" />
                </div>
            }
            else
            {
                <div class="access-denied">
                    <h3>Access Denied</h3>
                    <p>You don't have permission to use the AI query interface.</p>
                    <p>Contact your administrator to request access.</p>
                </div>
            }
        </Authorized>
        <NotAuthorized>
            <LoginComponent OnLoginSuccess="@HandleLoginSuccess" />
        </NotAuthorized>
    </AuthorizeView>
</CascadingAuthenticationState>

@code {
    private UserPermissions userPermissions;
    private DateTime sessionExpiry;
    private Timer sessionTimer;

    protected override async Task OnInitializedAsync()
    {
        var authState = await AuthStateProvider.GetAuthenticationStateAsync();
        if (authState.User.Identity.IsAuthenticated)
        {
            userPermissions = await SecurityService.GetUserPermissionsAsync(authState.User);
            sessionExpiry = DateTime.Now.AddHours(8);

            // Set up session monitoring
            sessionTimer = new Timer(CheckSession, null, TimeSpan.FromMinutes(1), TimeSpan.FromMinutes(1));
        }
    }

    private async Task HandleQueryExecuted(VannaQueryResult result)
    {
        // Log all AI queries for audit trail
        await SecurityService.LogQueryExecutionAsync(userPermissions.UserId, result);

        // Check if we need to mask sensitive data
        result.FilteredResults = await SecurityService.ApplyDataMaskingAsync(result.Results, userPermissions);

        StateHasChanged();
    }

    private async Task HandleLoginSuccess()
    {
        // Refresh the page to load user permissions
        await JSRuntime.InvokeVoidAsync("location.reload");
    }

    private async void CheckSession(object state)
    {
        if (DateTime.Now >= sessionExpiry)
        {
            await JSRuntime.InvokeVoidAsync("alert", "Your session has expired. Please log in again.");
            await JSRuntime.InvokeVoidAsync("location.reload");
        }
    }

    public void Dispose()
    {
        sessionTimer?.Dispose();
    }
}
```

## Role-Based Query Permissions

The key insight from our government implementations is that AI query permissions need to be more granular than traditional database roles. Users need different levels of access to different types of data, and the AI system must respect these boundaries when generating SQL.

```csharp
// Services/VannaSecurityService.cs
public class VannaSecurityService
{
    private readonly IUserRepository _userRepository;
    private readonly IAuditLogger _auditLogger;
    private readonly IDataClassificationService _dataClassification;
    private readonly ILogger<VannaSecurityService> _logger;

    public async Task<UserPermissions> GetUserPermissionsAsync(ClaimsPrincipal user)
    {
        var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var dataAccessLevel = user.FindFirst("data_access_level")?.Value;
        var department = user.FindFirst("department")?.Value;

        var permissions = new UserPermissions
        {
            UserId = userId,
            Username = user.Identity.Name,
            DataAccessLevel = Enum.Parse<DataAccessLevel>(dataAccessLevel),
            Department = department,
            CanUseVannaAI = await CheckVannaAIPermissionAsync(userId),
            AllowedSchemas = await GetAllowedSchemasAsync(userId, dataAccessLevel),
            AllowedTables = await GetAllowedTablesAsync(userId, dataAccessLevel),
            RestrictedColumns = await GetRestrictedColumnsAsync(userId, dataAccessLevel),
            MaxRowsPerQuery = GetMaxRowsForAccessLevel(dataAccessLevel),
            RateLimitPerMinute = GetRateLimitForAccessLevel(dataAccessLevel)
        };

        return permissions;
    }

    public async Task<bool> ValidateQueryPermissionsAsync(string generatedSQL, UserPermissions permissions)
    {
        try
        {
            // Parse the SQL to extract table and column references
            var sqlAnalysis = await AnalyzeSQLQueryAsync(generatedSQL);

            // Check schema access
            foreach (var schema in sqlAnalysis.ReferencedSchemas)
            {
                if (!permissions.AllowedSchemas.Contains(schema))
                {
                    _logger.LogWarning("User {UserId} attempted to access restricted schema: {Schema}",
                        permissions.UserId, schema);
                    return false;
                }
            }

            // Check table access
            foreach (var table in sqlAnalysis.ReferencedTables)
            {
                if (!permissions.AllowedTables.Contains(table))
                {
                    _logger.LogWarning("User {UserId} attempted to access restricted table: {Table}",
                        permissions.UserId, table);
                    return false;
                }
            }

            // Check for restricted columns
            foreach (var column in sqlAnalysis.ReferencedColumns)
            {
                if (permissions.RestrictedColumns.Contains(column))
                {
                    _logger.LogWarning("User {UserId} attempted to access restricted column: {Column}",
                        permissions.UserId, column);
                    return false;
                }
            }

            // Check row limit
            if (sqlAnalysis.HasLimit && sqlAnalysis.LimitValue > permissions.MaxRowsPerQuery)
            {
                _logger.LogWarning("User {UserId} attempted to exceed row limit: {RequestedLimit} > {MaxAllowed}",
                    permissions.UserId, sqlAnalysis.LimitValue, permissions.MaxRowsPerQuery);
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating query permissions for user: {UserId}", permissions.UserId);
            return false; // Fail secure
        }
    }

    private async Task<SQLAnalysisResult> AnalyzeSQLQueryAsync(string sql)
    {
        // Use a SQL parser library like Microsoft.SqlServer.TransactSql.ScriptDom
        // or implement a regex-based approach for simpler cases
        var parser = new SQLSecurityParser();
        return await parser.AnalyzeQueryAsync(sql);
    }

    public async Task<object> ApplyDataMaskingAsync(object queryResults, UserPermissions permissions)
    {
        if (queryResults == null) return null;

        var results = queryResults as IEnumerable<dynamic>;
        if (results == null) return queryResults;

        var maskedResults = new List<Dictionary<string, object>>();

        foreach (var row in results)
        {
            var maskedRow = new Dictionary<string, object>();
            var rowDict = (IDictionary<string, object>)row;

            foreach (var column in rowDict)
            {
                var columnClassification = await _dataClassification.GetColumnClassificationAsync(column.Key);

                if (ShouldMaskColumn(columnClassification, permissions.DataAccessLevel))
                {
                    maskedRow[column.Key] = MaskValue(column.Value, columnClassification.MaskingType);
                }
                else
                {
                    maskedRow[column.Key] = column.Value;
                }
            }

            maskedResults.Add(maskedRow);
        }

        return maskedResults;
    }

    private bool ShouldMaskColumn(DataClassification classification, DataAccessLevel userLevel)
    {
        return classification.SecurityLevel switch
        {
            SecurityLevel.Public => false,
            SecurityLevel.Internal => userLevel < DataAccessLevel.Internal,
            SecurityLevel.Confidential => userLevel < DataAccessLevel.Confidential,
            SecurityLevel.Secret => userLevel < DataAccessLevel.Secret,
            _ => true // Mask unknown classifications
        };
    }

    private object MaskValue(object value, MaskingType maskingType)
    {
        if (value == null) return null;

        return maskingType switch
        {
            MaskingType.Full => "***MASKED***",
            MaskingType.Partial => MaskPartialValue(value.ToString()),
            MaskingType.Email => MaskEmail(value.ToString()),
            MaskingType.SSN => MaskSSN(value.ToString()),
            MaskingType.CreditCard => "****-****-****-" + value.ToString().Substring(Math.Max(0, value.ToString().Length - 4)),
            _ => "***MASKED***"
        };
    }
}

public class UserPermissions
{
    public string UserId { get; set; }
    public string Username { get; set; }
    public DataAccessLevel DataAccessLevel { get; set; }
    public string Department { get; set; }
    public bool CanUseVannaAI { get; set; }
    public List<string> AllowedSchemas { get; set; } = new();
    public List<string> AllowedTables { get; set; } = new();
    public List<string> RestrictedColumns { get; set; } = new();
    public int MaxRowsPerQuery { get; set; }
    public int RateLimitPerMinute { get; set; }
}

public enum DataAccessLevel
{
    Public = 1,
    Internal = 2,
    Confidential = 3,
    Secret = 4
}
```

## Implementing Rate Limiting and Abuse Prevention

AI-powered queries can be expensive and resource-intensive. We implemented comprehensive rate limiting to prevent abuse while maintaining usability for legitimate users:

```csharp
// Middleware/VannaRateLimitMiddleware.cs
public class VannaRateLimitMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IMemoryCache _cache;
    private readonly ILogger<VannaRateLimitMiddleware> _logger;
    private readonly VannaRateLimitOptions _options;

    public VannaRateLimitMiddleware(
        RequestDelegate next,
        IMemoryCache cache,
        ILogger<VannaRateLimitMiddleware> logger,
        IOptions<VannaRateLimitOptions> options)
    {
        _next = next;
        _cache = cache;
        _logger = logger;
        _options = options.Value;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Only apply to Vanna AI endpoints
        if (!context.Request.Path.StartsWithSegments("/api/vanna"))
        {
            await _next(context);
            return;
        }

        var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
        {
            context.Response.StatusCode = 401;
            await context.Response.WriteAsync("Unauthorized");
            return;
        }

        var userPermissions = await GetUserPermissionsAsync(context.User);
        var rateLimitKey = $"vanna_rate_limit:{userId}";
        var rateLimitInfo = _cache.GetOrCreate(rateLimitKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1);
            return new RateLimitInfo
            {
                RequestCount = 0,
                WindowStart = DateTime.UtcNow,
                Limit = userPermissions.RateLimitPerMinute
            };
        });

        // Check if rate limit exceeded
        if (rateLimitInfo.RequestCount >= rateLimitInfo.Limit)
        {
            _logger.LogWarning("Rate limit exceeded for user: {UserId}. Requests: {Count}/{Limit}",
                userId, rateLimitInfo.RequestCount, rateLimitInfo.Limit);

            context.Response.StatusCode = 429;
            context.Response.Headers.Add("Retry-After", "60");
            await context.Response.WriteAsync($"Rate limit exceeded. Maximum {rateLimitInfo.Limit} requests per minute.");
            return;
        }

        // Increment request count
        rateLimitInfo.RequestCount++;
        _cache.Set(rateLimitKey, rateLimitInfo, TimeSpan.FromMinutes(1));

        // Add rate limit headers
        context.Response.Headers.Add("X-RateLimit-Limit", rateLimitInfo.Limit.ToString());
        context.Response.Headers.Add("X-RateLimit-Remaining",
            Math.Max(0, rateLimitInfo.Limit - rateLimitInfo.RequestCount).ToString());
        context.Response.Headers.Add("X-RateLimit-Reset",
            DateTimeOffset.UtcNow.AddMinutes(1).ToUnixTimeSeconds().ToString());

        await _next(context);
    }
}

public class RateLimitInfo
{
    public int RequestCount { get; set; }
    public DateTime WindowStart { get; set; }
    public int Limit { get; set; }
}
```

## Comprehensive Audit Logging

For compliance with government regulations, every AI interaction must be logged with complete context:

```csharp
// Services/VannaAuditService.cs
public class VannaAuditService : IAuditLogger
{
    private readonly ILogger<VannaAuditService> _logger;
    private readonly IAuditRepository _auditRepository;
    private readonly IConfiguration _configuration;

    public async Task LogQueryExecutionAsync(string userId, VannaQueryResult result)
    {
        var auditEntry = new VannaAuditEntry
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Timestamp = DateTime.UtcNow,
            UserQuery = result.OriginalQuery,
            GeneratedSQL = result.GeneratedSQL,
            ExecutionTimeMs = result.ExecutionTimeMs,
            RowsReturned = result.RowCount,
            Success = result.Success,
            ErrorMessage = result.ErrorMessage,
            DataClassifications = result.DataClassifications,
            IPAddress = result.IPAddress,
            UserAgent = result.UserAgent,
            SessionId = result.SessionId
        };

        try
        {
            // Store in audit database
            await _auditRepository.SaveAuditEntryAsync(auditEntry);

            // Also log to structured logging for real-time monitoring
            _logger.LogInformation("Vanna AI Query Executed: {UserId} | Query: {Query} | SQL: {SQL} | Rows: {Rows} | Time: {Time}ms",
                userId,
                result.OriginalQuery,
                result.GeneratedSQL,
                result.RowCount,
                result.ExecutionTimeMs);

            // Alert on suspicious patterns
            await CheckForSuspiciousActivityAsync(userId, auditEntry);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to log audit entry for user: {UserId}", userId);
            // Don't throw - audit failures shouldn't break the main functionality
        }
    }

    private async Task CheckForSuspiciousActivityAsync(string userId, VannaAuditEntry entry)
    {
        var recentEntries = await _auditRepository.GetRecentEntriesAsync(userId, TimeSpan.FromMinutes(5));

        // Check for rapid-fire queries
        if (recentEntries.Count() > 20)
        {
            _logger.LogWarning("Suspicious activity detected: Rapid queries from user {UserId}", userId);
            await NotifySecurityTeamAsync(userId, "Rapid query execution detected");
        }

        // Check for attempts to access restricted data
        if (entry.GeneratedSQL.Contains("WHERE 1=1") || entry.GeneratedSQL.Contains("DROP") || entry.GeneratedSQL.Contains("DELETE"))
        {
            _logger.LogWarning("Suspicious SQL generated for user {UserId}: {SQL}", userId, entry.GeneratedSQL);
            await NotifySecurityTeamAsync(userId, "Potentially malicious SQL generated");
        }

        // Check for excessive data extraction
        if (entry.RowsReturned > 10000)
        {
            _logger.LogWarning("Large data extraction by user {UserId}: {Rows} rows", userId, entry.RowsReturned);
            await NotifySecurityTeamAsync(userId, "Large data extraction detected");
        }
    }

    public async Task<AuditReport> GenerateComplianceReportAsync(DateTime startDate, DateTime endDate)
    {
        var entries = await _auditRepository.GetEntriesInRangeAsync(startDate, endDate);

        return new AuditReport
        {
            Period = $"{startDate:yyyy-MM-dd} to {endDate:yyyy-MM-dd}",
            TotalQueries = entries.Count(),
            UniqueUsers = entries.Select(e => e.UserId).Distinct().Count(),
            SuccessRate = entries.Count(e => e.Success) / (double)entries.Count() * 100,
            AverageExecutionTime = entries.Average(e => e.ExecutionTimeMs),
            DataAccessBreakdown = entries
                .SelectMany(e => e.DataClassifications)
                .GroupBy(c => c)
                .ToDictionary(g => g.Key, g => g.Count()),
            SecurityAlerts = entries.Count(e => e.GeneratedAlerts > 0),
            ComplianceStatus = "COMPLIANT" // Based on your specific requirements
        };
    }
}

public class VannaAuditEntry
{
    public Guid Id { get; set; }
    public string UserId { get; set; }
    public DateTime Timestamp { get; set; }
    public string UserQuery { get; set; }
    public string GeneratedSQL { get; set; }
    public long ExecutionTimeMs { get; set; }
    public int RowsReturned { get; set; }
    public bool Success { get; set; }
    public string ErrorMessage { get; set; }
    public List<string> DataClassifications { get; set; } = new();
    public string IPAddress { get; set; }
    public string UserAgent { get; set; }
    public string SessionId { get; set; }
    public int GeneratedAlerts { get; set; }
}
```

## Input Validation and SQL Injection Prevention

Even though we're using Vanna AI to generate SQL, we still need robust input validation to prevent malicious prompts:

```csharp
// Services/VannaInputValidationService.cs
public class VannaInputValidationService
{
    private readonly ILogger<VannaInputValidationService> _logger;
    private readonly List<string> _suspiciousPatterns;
    private readonly List<string> _blockedKeywords;

    public VannaInputValidationService(ILogger<VannaInputValidationService> logger)
    {
        _logger = logger;

        _suspiciousPatterns = new List<string>
        {
            @"(?i)\b(drop|delete|truncate|alter|create|insert|update)\b.*\b(table|database|schema|user)\b",
            @"(?i)union\s+select",
            @"(?i)1\s*=\s*1",
            @"(?i)or\s+1\s*=\s*1",
            @"(?i);.*drop",
            @"(?i)exec\s*\(",
            @"(?i)xp_cmdshell",
            @"(?i)sp_executesql"
        };

        _blockedKeywords = new List<string>
        {
            "password", "pwd", "secret", "token", "key", "admin", "root",
            "ssn", "social_security", "credit_card", "ccn", "salary", "wage"
        };
    }

    public ValidationResult ValidateQuery(string userQuery, UserPermissions permissions)
    {
        if (string.IsNullOrWhiteSpace(userQuery))
        {
            return ValidationResult.Invalid("Query cannot be empty");
        }

        // Check length limits
        if (userQuery.Length > 1000)
        {
            _logger.LogWarning("Query too long from user {UserId}: {Length} characters",
                permissions.UserId, userQuery.Length);
            return ValidationResult.Invalid("Query too long. Maximum 1000 characters allowed.");
        }

        // Check for suspicious SQL injection patterns
        foreach (var pattern in _suspiciousPatterns)
        {
            if (System.Text.RegularExpressions.Regex.IsMatch(userQuery, pattern))
            {
                _logger.LogWarning("Suspicious pattern detected in query from user {UserId}: {Query}",
                    permissions.UserId, userQuery);
                return ValidationResult.Invalid("Query contains potentially malicious content");
            }
        }

        // Check for attempts to access restricted data
        foreach (var keyword in _blockedKeywords)
        {
            if (userQuery.ToLower().Contains(keyword.ToLower()) &&
                permissions.DataAccessLevel < DataAccessLevel.Confidential)
            {
                _logger.LogWarning("Attempt to access restricted data by user {UserId}: {Query}",
                    permissions.UserId, userQuery);
                return ValidationResult.Invalid($"You don't have permission to query {keyword} data");
            }
        }

        // Validate against user's allowed data scope
        var sanitizedQuery = SanitizeQuery(userQuery);

        return ValidationResult.Valid(sanitizedQuery);
    }

    private string SanitizeQuery(string query)
    {
        // Remove potentially harmful characters while preserving meaning
        var sanitized = query
            .Replace("'", "''")  // Escape single quotes
            .Replace("\"", "\\\"") // Escape double quotes
            .Trim();

        // Remove any remaining suspicious characters
        sanitized = System.Text.RegularExpressions.Regex.Replace(
            sanitized, @"[<>{}]", "");

        return sanitized;
    }
}

public class ValidationResult
{
    public bool IsValid { get; set; }
    public string SanitizedQuery { get; set; }
    public string ErrorMessage { get; set; }

    public static ValidationResult Valid(string sanitizedQuery)
        => new() { IsValid = true, SanitizedQuery = sanitizedQuery };

    public static ValidationResult Invalid(string error)
        => new() { IsValid = false, ErrorMessage = error };
}
```

## Production Security Testing

Here's the security testing framework we use to validate our AI query security controls:

```csharp
// Tests/VannaSecurityTests.cs
[TestClass]
public class VannaSecurityTests
{
    private VannaSecurityService _securityService;
    private VannaInputValidationService _validationService;
    private Mock<IUserRepository> _mockUserRepo;
    private Mock<IAuditLogger> _mockAuditLogger;

    [TestInitialize]
    public void Setup()
    {
        _mockUserRepo = new Mock<IUserRepository>();
        _mockAuditLogger = new Mock<IAuditLogger>();
        _securityService = new VannaSecurityService(_mockUserRepo.Object, _mockAuditLogger.Object, null, null);
        _validationService = new VannaInputValidationService(Mock.Of<ILogger<VannaInputValidationService>>());
    }

    [TestMethod]
    public async Task Should_Block_SQL_Injection_Attempts()
    {
        var maliciousQueries = new[]
        {
            "Show me all users; DROP TABLE users;",
            "Find customers WHERE 1=1 OR 1=1",
            "List products UNION SELECT * FROM admin_users",
            "Get sales data'; EXEC xp_cmdshell 'dir';"
        };

        var lowPrivilegeUser = new UserPermissions
        {
            UserId = "test-user",
            DataAccessLevel = DataAccessLevel.Public
        };

        foreach (var query in maliciousQueries)
        {
            var result = _validationService.ValidateQuery(query, lowPrivilegeUser);
            Assert.IsFalse(result.IsValid, $"Should have blocked malicious query: {query}");
        }
    }

    [TestMethod]
    public async Task Should_Respect_Data_Access_Levels()
    {
        var publicUser = new UserPermissions
        {
            DataAccessLevel = DataAccessLevel.Public,
            AllowedTables = new() { "public_products", "public_categories" }
        };

        var confidentialUser = new UserPermissions
        {
            DataAccessLevel = DataAccessLevel.Confidential,
            AllowedTables = new() { "public_products", "employee_data", "salary_info" }
        };

        var restrictedQuery = "SELECT * FROM employee_data WHERE department = 'HR'";

        var publicResult = await _securityService.ValidateQueryPermissionsAsync(restrictedQuery, publicUser);
        var confidentialResult = await _securityService.ValidateQueryPermissionsAsync(restrictedQuery, confidentialUser);

        Assert.IsFalse(publicResult, "Public user should not access employee data");
        Assert.IsTrue(confidentialResult, "Confidential user should access employee data");
    }

    [TestMethod]
    public async Task Should_Apply_Data_Masking_Correctly()
    {
        var testData = new[]
        {
            new Dictionary<string, object>
            {
                ["employee_name"] = "John Doe",
                ["ssn"] = "123-45-6789",
                ["salary"] = 75000,
                ["department"] = "Engineering"
            }
        };

        var publicUser = new UserPermissions
        {
            DataAccessLevel = DataAccessLevel.Public
        };

        var maskedResults = await _securityService.ApplyDataMaskingAsync(testData, publicUser);
        var maskedArray = ((IEnumerable<Dictionary<string, object>>)maskedResults).ToArray();

        Assert.AreEqual("***MASKED***", maskedArray[0]["ssn"]);
        Assert.AreEqual("***MASKED***", maskedArray[0]["salary"]);
        Assert.AreEqual("Engineering", maskedArray[0]["department"]); // Public field
    }

    [TestMethod]
    public async Task Should_Log_All_Query_Attempts()
    {
        var query = "SELECT COUNT(*) FROM orders WHERE date > '2024-01-01'";
        var result = new VannaQueryResult
        {
            OriginalQuery = query,
            GeneratedSQL = "SELECT COUNT(*) FROM orders WHERE order_date > '2024-01-01'",
            Success = true,
            RowCount = 1,
            ExecutionTimeMs = 250
        };

        await _securityService.LogQueryExecutionAsync("test-user", result);

        _mockAuditLogger.Verify(
            x => x.LogQueryExecutionAsync("test-user", It.IsAny<VannaQueryResult>()),
            Times.Once,
            "All queries should be logged for audit trail"
        );
    }
}
```

## Key Security Takeaways

After implementing this comprehensive security framework across multiple federal systems, here are the critical insights that have proven essential:

**Multi-Layer Defense is Non-Negotiable**: AI-powered query systems require security controls at the authentication, authorization, input validation, SQL generation, execution, and output filtering layers. A vulnerability in any single layer can compromise the entire system.

**Audit Everything**: Government auditors will scrutinize every AI interaction. Comprehensive logging isn't just good practice—it's a compliance requirement. Log not just what was queried, but who asked, when, what data was accessed, and what security controls were applied.

**Fail Secure**: When in doubt, deny access. It's better to occasionally block legitimate queries than to risk exposing sensitive data. Our validation logic always defaults to the most restrictive interpretation when permissions are ambiguous.

**Rate Limiting Prevents Abuse**: AI queries can be expensive and resource-intensive. Implement both per-user rate limits and system-wide throttling to prevent both accidental and malicious abuse.

**Data Classification is Critical**: Not all database columns are created equal. Implement a comprehensive data classification system that automatically applies appropriate masking and access controls based on data sensitivity levels.

The security framework we've built has successfully passed multiple FedRAMP audits and handles millions of AI-powered queries across our government systems. The key is treating AI as an amplifier of existing security risks, not a replacement for traditional database security controls.

In [Part 3 of this series](/blog/scaling-vanna-ai-blazor-performance-optimization), we'll explore how to scale this secure AI query system for high-traffic environments, including caching strategies, performance optimization, and handling concurrent users while maintaining security controls.

---

**Need help implementing secure AI query systems in your environment?** I specialize in building compliant AI solutions for government and enterprise clients. [Contact me](/contact) to discuss your specific security requirements.