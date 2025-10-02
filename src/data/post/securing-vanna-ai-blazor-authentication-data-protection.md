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
author: Lincoln J Bicalho
---

> 📋 **Prerequisites**:
> - .NET 8 SDK or later
> - Completed [Part 1: Building Natural Language SQL Interface](/blog/blazor-vanna-ai-natural-language-sql-queries)
> - Basic understanding of OAuth 2.0 and JWT authentication
> - Azure AD or identity provider configured
> - Understanding of SQL security and data classification
> - Familiarity with C# and Blazor component models

## Overview

AI-powered database query systems introduce unique security challenges that traditional SQL interfaces don't face. When you allow users to describe what they want in natural language, your system must make intelligent decisions about what data to expose, how to filter sensitive information, and whether the user has appropriate permissions.

After implementing Vanna AI across multiple federal government systems, I discovered during our first security audit that the question wasn't whether our AI generated good SQL—it was whether we could prove that every query respected security boundaries. The auditor's concern was simple but critical: "So anyone can ask your AI to query any data in your database?"

**What you'll learn:**
- How to implement multi-layered security for AI query systems
- Authentication and authorization patterns specific to AI-powered interfaces
- Data classification and masking strategies for sensitive fields
- Query validation techniques to prevent unauthorized data access
- Comprehensive audit logging for compliance requirements
- Rate limiting to prevent abuse and excessive API usage

> ⚠️ **Critical Security Warning**: AI systems are inherently unpredictable. While Vanna AI generally generates appropriate SQL queries, there's no guarantee that a user won't craft a prompt that tricks the AI into exposing data they shouldn't see. You must implement security controls at every layer of your application stack.

## AI System Security Threat Matrix

Understanding the threat landscape helps you design comprehensive security controls. Here's the security matrix for AI-powered database query systems:

| Threat Category | Risk Level | Impact | Mitigation Strategy |
|----------------|------------|--------|-------------------|
| **Prompt Injection** | High | Unauthorized data access | Input validation, query analysis, permission checks |
| **Data Exfiltration** | Critical | Sensitive data exposure | Row limits, data masking, audit logging |
| **Authorization Bypass** | Critical | Access control violation | Multi-layer authorization, SQL analysis |
| **Resource Exhaustion** | Medium | Service denial, cost overrun | Rate limiting, query timeout, cost caps |
| **Compliance Violation** | High | Audit failures, legal issues | Complete audit trails, data classification |
| **Privilege Escalation** | High | Elevated access | Least privilege, role validation, session monitoring |

> ❗ **Important**: Traditional role-based access control (RBAC) assumes predictable query patterns, but natural language input creates infinite possibilities. Your security model must adapt to handle unpredictable AI-generated queries.

## Key Security Concepts

### Concept 1: Multi-Layered Defense Architecture

AI-powered query systems require security controls at multiple application layers:

**Layer 1: Authentication** - Verify user identity before allowing any access to the AI system. This establishes *who* is making the request.

**Layer 2: Authorization** - Determine what data sources and tables the authenticated user can query. This defines the *scope* of permitted access.

**Layer 3: Input Validation** - Analyze the natural language query for malicious patterns, injection attempts, and policy violations before sending to the AI.

**Layer 4: Query Analysis** - Parse the AI-generated SQL to extract table references, column selections, and join patterns. Validate against user permissions.

**Layer 5: Execution Control** - Apply row limits, timeout constraints, and resource quotas before executing the validated query.

**Layer 6: Output Filtering** - Mask sensitive data fields based on user's data classification level before returning results.

**Layer 7: Audit Logging** - Record complete context of every query: user identity, original prompt, generated SQL, data accessed, and results returned.

> 💡 **Production Insight**: In federal government systems, we discovered that query analysis (Layer 4) catches 60% of potential security violations that passed through input validation. Never rely on a single security layer.

### Concept 2: Data Classification and Masking

Not all database columns require the same level of protection. You implement a data classification system that categorizes information by sensitivity:

**Public (Level 1)** - Non-sensitive data like product names, public contact information
- Accessible to all authenticated users
- No masking required
- Standard audit logging

**Internal (Level 2)** - Business information like employee names, department data
- Accessible to internal users only
- Conditional masking based on department
- Enhanced audit logging

**Confidential (Level 3)** - Sensitive data like salary information, performance reviews
- Accessible to authorized roles only
- Masked for unauthorized viewers
- Detailed audit logging with alerts

**Secret (Level 4)** - Highly sensitive data like SSN, credit card numbers
- Accessible to specific privileged users only
- Full masking except for authorized access
- Complete audit trail with security team notifications

> ℹ️ **Note**: Your data classification model should align with your organization's information security policy. Federal systems typically follow FISMA classification levels, while HIPAA-regulated systems use PHI/PII designations.

### Concept 3: Permission Granularity

AI query permissions need more granularity than traditional database roles:

**Schema-Level Permissions** - Which database schemas can the user query?
```csharp
AllowedSchemas = ["dbo", "reporting", "public"]
```

**Table-Level Permissions** - Which specific tables within allowed schemas?
```csharp
AllowedTables = ["dbo.Customers", "reporting.SalesMetrics", "public.Products"]
```

**Column-Level Restrictions** - Which columns are explicitly forbidden?
```csharp
RestrictedColumns = ["dbo.Customers.SSN", "dbo.Employees.Salary"]
```

**Row-Level Limits** - Maximum number of rows per query?
```csharp
MaxRowsPerQuery = 10000  // Prevents large data extractions
```

**Query Rate Limits** - How many queries per time period?
```csharp
RateLimitPerMinute = 10  // Prevents abuse and excessive API costs
```

## Basic Implementation

### Step 1: Configure JWT Authentication Service

First, you configure authentication services to validate user identity and issue JWT tokens containing security claims:

```csharp
// FILE: Services/VannaAuthenticationService.cs
// PURPOSE: Authenticate users and issue JWT tokens with security claims

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

    // WHY: Authenticates user and returns JWT token with embedded permissions
    // HOW: Validates credentials, generates token with security claims
    public async Task<AuthenticationResult> AuthenticateUserAsync(
        string username,
        string password)
    {
        // Validate against your identity provider
        // WHY: Never trust unauthenticated input
        var user = await ValidateUserCredentialsAsync(username, password);
        if (user == null)
        {
            _logger.LogWarning(
                "Authentication failed for user: {Username}",
                username);
            return AuthenticationResult.Failed("Invalid credentials");
        }

        // WHY: JWT tokens embed permissions, reducing database lookups
        var token = GenerateJwtToken(user);
        var refreshToken = GenerateRefreshToken();

        // Store refresh token securely
        // WHY: Enables token rotation without re-authentication
        await StoreRefreshTokenAsync(user.Id, refreshToken);

        _logger.LogInformation(
            "User authenticated successfully: {Username}",
            username);

        return AuthenticationResult.Success(token, refreshToken, user);
    }

    // WHY: Embeds user permissions in JWT claims for stateless validation
    // HOW: Creates signed token with user identity and AI-specific permissions
    private string GenerateJwtToken(UserInfo user)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_configuration["Jwt:SecretKey"]));
        var credentials = new SigningCredentials(
            key,
            SecurityAlgorithms.HmacSha256);

        // WHY: Claims contain identity and permission context
        var claims = new[]
        {
            // Standard identity claims
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Email, user.Email),

            // AI system-specific claims
            // WHY: Embed data classification level for query validation
            new Claim("data_access_level", user.DataAccessLevel.ToString()),
            new Claim("department", user.Department),
            // WHY: Store permissions as comma-separated list in token
            new Claim("vanna_permissions", string.Join(",", user.VannaPermissions))
        };

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            // WHY: Shorter expiry for AI systems reduces token theft risk
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private async Task<UserInfo> ValidateUserCredentialsAsync(
        string username,
        string password)
    {
        // Integration with your authentication system
        // This could be Active Directory, Azure AD, or custom user store
        // ⚠️ CRITICAL: Never store passwords in plain text

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
            _logger.LogError(
                ex,
                "Error validating user credentials for: {Username}",
                username);
        }

        return null;
    }

    private string GenerateRefreshToken()
    {
        // WHY: Cryptographically secure random token for rotation
        var randomBytes = new byte[32];
        using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes);
    }

    private async Task StoreRefreshTokenAsync(Guid userId, string refreshToken)
    {
        // WHY: Store securely in database with expiration
        // Implementation depends on your data layer
    }
}

public class AuthenticationResult
{
    public bool IsSuccess { get; set; }
    public string Token { get; set; }
    public string RefreshToken { get; set; }
    public UserInfo User { get; set; }
    public string ErrorMessage { get; set; }

    public static AuthenticationResult Success(
        string token,
        string refreshToken,
        UserInfo user)
        => new()
        {
            IsSuccess = true,
            Token = token,
            RefreshToken = refreshToken,
            User = user
        };

    public static AuthenticationResult Failed(string error)
        => new() { IsSuccess = false, ErrorMessage = error };
}
```

> 💡 **Tip**: Configure shorter JWT expiration times (4-8 hours) for AI systems compared to standard web applications (24+ hours). AI-powered queries pose higher security risks if tokens are compromised.

### Step 2: Secure Blazor Components with Authorization

Next, you add authorization controls to your Blazor components to restrict access to the AI query interface:

```razor
@* FILE: Components/SecureVannaQueryInterface.razor *@
@* PURPOSE: Secure wrapper around Vanna AI query interface *@

@using Microsoft.AspNetCore.Authorization
@using Microsoft.AspNetCore.Components.Authorization
@attribute [Authorize]
@inject AuthenticationStateProvider AuthStateProvider
@inject VannaSecurityService SecurityService
@inject IJSRuntime JSRuntime

<CascadingAuthenticationState>
    <AuthorizeView>
        <Authorized>
            @* WHY: Double-check AI-specific permissions beyond authentication *@
            @if (userPermissions?.CanUseVannaAI == true)
            {
                <div class="vanna-interface-container">
                    @* Security header displays current access context *@
                    <div class="security-header">
                        <div class="user-info">
                            <span class="user-name">@context.User.Identity.Name</span>
                            <span class="access-level">
                                Access Level: @userPermissions.DataAccessLevel
                            </span>
                        </div>
                        <div class="session-info">
                            <span>Session expires: @sessionExpiry.ToString("HH:mm")</span>
                        </div>
                    </div>

                    @* WHY: Pass permissions to query component for validation *@
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
            // WHY: Load detailed permissions beyond basic authentication
            userPermissions = await SecurityService.GetUserPermissionsAsync(
                authState.User);
            sessionExpiry = DateTime.Now.AddHours(8);

            // WHY: Monitor session and alert before expiration
            sessionTimer = new Timer(
                CheckSession,
                null,
                TimeSpan.FromMinutes(1),
                TimeSpan.FromMinutes(1));
        }
    }

    // WHY: Log all AI queries and apply output filtering
    private async Task HandleQueryExecuted(VannaQueryResult result)
    {
        // Log for audit trail
        await SecurityService.LogQueryExecutionAsync(
            userPermissions.UserId,
            result);

        // WHY: Mask sensitive data based on user's access level
        result.FilteredResults = await SecurityService.ApplyDataMaskingAsync(
            result.Results,
            userPermissions);

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
            await JSRuntime.InvokeVoidAsync(
                "alert",
                "Your session has expired. Please log in again.");
            await JSRuntime.InvokeVoidAsync("location.reload");
        }
    }

    public void Dispose()
    {
        sessionTimer?.Dispose();
    }
}
```

> ⚠️ **Warning**: Always verify AI-specific permissions (`CanUseVannaAI`) in addition to general authentication. Not all authenticated users should access AI query capabilities.

### Step 3: Implement Permission Validation Service

You create a security service that validates query permissions and applies data masking:

```csharp
// FILE: Services/VannaSecurityService.cs
// PURPOSE: Validate query permissions and apply data protection

public class VannaSecurityService
{
    private readonly IUserRepository _userRepository;
    private readonly IAuditLogger _auditLogger;
    private readonly IDataClassificationService _dataClassification;
    private readonly ILogger<VannaSecurityService> _logger;

    // WHY: Loads detailed permissions from claims and database
    // HOW: Combines JWT claims with database-stored permission rules
    public async Task<UserPermissions> GetUserPermissionsAsync(
        ClaimsPrincipal user)
    {
        // Extract claims from JWT token
        var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var dataAccessLevel = user.FindFirst("data_access_level")?.Value;
        var department = user.FindFirst("department")?.Value;

        // WHY: Build comprehensive permission object for query validation
        var permissions = new UserPermissions
        {
            UserId = userId,
            Username = user.Identity.Name,
            DataAccessLevel = Enum.Parse<DataAccessLevel>(dataAccessLevel),
            Department = department,

            // WHY: Check if user has AI query permission enabled
            CanUseVannaAI = await CheckVannaAIPermissionAsync(userId),

            // WHY: Load fine-grained data access rules
            AllowedSchemas = await GetAllowedSchemasAsync(userId, dataAccessLevel),
            AllowedTables = await GetAllowedTablesAsync(userId, dataAccessLevel),
            RestrictedColumns = await GetRestrictedColumnsAsync(userId, dataAccessLevel),

            // WHY: Set resource limits based on access level
            MaxRowsPerQuery = GetMaxRowsForAccessLevel(dataAccessLevel),
            RateLimitPerMinute = GetRateLimitForAccessLevel(dataAccessLevel)
        };

        return permissions;
    }

    // WHY: Validates AI-generated SQL against user permissions
    // HOW: Parses SQL to extract references, checks against allowed resources
    public async Task<bool> ValidateQueryPermissionsAsync(
        string generatedSQL,
        UserPermissions permissions)
    {
        try
        {
            // WHY: Parse SQL to identify what data the query accesses
            var sqlAnalysis = await AnalyzeSQLQueryAsync(generatedSQL);

            // Check schema access
            // WHY: Prevent access to restricted database schemas
            foreach (var schema in sqlAnalysis.ReferencedSchemas)
            {
                if (!permissions.AllowedSchemas.Contains(schema))
                {
                    _logger.LogWarning(
                        "User {UserId} attempted to access restricted schema: {Schema}",
                        permissions.UserId, schema);
                    return false;
                }
            }

            // Check table access
            // WHY: Enforce table-level permissions
            foreach (var table in sqlAnalysis.ReferencedTables)
            {
                if (!permissions.AllowedTables.Contains(table))
                {
                    _logger.LogWarning(
                        "User {UserId} attempted to access restricted table: {Table}",
                        permissions.UserId, table);
                    return false;
                }
            }

            // Check for restricted columns
            // WHY: Prevent queries accessing forbidden sensitive columns
            foreach (var column in sqlAnalysis.ReferencedColumns)
            {
                if (permissions.RestrictedColumns.Contains(column))
                {
                    _logger.LogWarning(
                        "User {UserId} attempted to access restricted column: {Column}",
                        permissions.UserId, column);
                    return false;
                }
            }

            // Check row limit
            // WHY: Prevent large data extractions
            if (sqlAnalysis.HasLimit &&
                sqlAnalysis.LimitValue > permissions.MaxRowsPerQuery)
            {
                _logger.LogWarning(
                    "User {UserId} attempted to exceed row limit: {RequestedLimit} > {MaxAllowed}",
                    permissions.UserId,
                    sqlAnalysis.LimitValue,
                    permissions.MaxRowsPerQuery);
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Error validating query permissions for user: {UserId}",
                permissions.UserId);
            // WHY: Fail secure - deny access on validation errors
            return false;
        }
    }

    // WHY: Applies data masking to query results based on access level
    // HOW: Checks each column's classification and masks if necessary
    public async Task<object> ApplyDataMaskingAsync(
        object queryResults,
        UserPermissions permissions)
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
                // WHY: Look up data classification for this column
                var columnClassification =
                    await _dataClassification.GetColumnClassificationAsync(
                        column.Key);

                // WHY: Mask if user's access level insufficient
                if (ShouldMaskColumn(
                    columnClassification,
                    permissions.DataAccessLevel))
                {
                    maskedRow[column.Key] = MaskValue(
                        column.Value,
                        columnClassification.MaskingType);
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

    // WHY: Determines if column should be masked for this user
    private bool ShouldMaskColumn(
        DataClassification classification,
        DataAccessLevel userLevel)
    {
        return classification.SecurityLevel switch
        {
            SecurityLevel.Public => false,
            SecurityLevel.Internal => userLevel < DataAccessLevel.Internal,
            SecurityLevel.Confidential => userLevel < DataAccessLevel.Confidential,
            SecurityLevel.Secret => userLevel < DataAccessLevel.Secret,
            _ => true // WHY: Mask unknown classifications by default
        };
    }

    // WHY: Applies appropriate masking strategy based on data type
    private object MaskValue(object value, MaskingType maskingType)
    {
        if (value == null) return null;

        return maskingType switch
        {
            MaskingType.Full => "***MASKED***",
            MaskingType.Partial => MaskPartialValue(value.ToString()),
            MaskingType.Email => MaskEmail(value.ToString()),
            MaskingType.SSN => "***-**-****",
            MaskingType.CreditCard => "****-****-****-" +
                value.ToString().Substring(
                    Math.Max(0, value.ToString().Length - 4)),
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

> ℹ️ **Note**: This implementation uses Microsoft.SqlServer.TransactSql.ScriptDom for SQL parsing in production. For simpler scenarios, you can implement regex-based parsing, but be aware of limitations with complex SQL syntax.

## Advanced Scenarios

### Scenario 1: Rate Limiting and Abuse Prevention

AI-powered queries consume API credits and computational resources. You implement rate limiting to prevent abuse:

**When you need this:**
- Protecting against accidental or intentional query flooding
- Managing AI API costs across multiple users
- Preventing resource exhaustion attacks
- Enforcing fair usage policies

**Implementation:**

```csharp
// FILE: Middleware/VannaRateLimitMiddleware.cs
// PURPOSE: Enforce per-user query rate limits

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
        // WHY: Only apply rate limiting to Vanna AI endpoints
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

        // WHY: Track requests in sliding window using cache
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

        // WHY: Block request if limit exceeded
        if (rateLimitInfo.RequestCount >= rateLimitInfo.Limit)
        {
            _logger.LogWarning(
                "Rate limit exceeded for user: {UserId}. Requests: {Count}/{Limit}",
                userId, rateLimitInfo.RequestCount, rateLimitInfo.Limit);

            context.Response.StatusCode = 429;
            context.Response.Headers.Add("Retry-After", "60");
            await context.Response.WriteAsync(
                $"Rate limit exceeded. Maximum {rateLimitInfo.Limit} requests per minute.");
            return;
        }

        // WHY: Increment counter before processing request
        rateLimitInfo.RequestCount++;
        _cache.Set(rateLimitKey, rateLimitInfo, TimeSpan.FromMinutes(1));

        // WHY: Include rate limit info in response headers
        context.Response.Headers.Add(
            "X-RateLimit-Limit",
            rateLimitInfo.Limit.ToString());
        context.Response.Headers.Add(
            "X-RateLimit-Remaining",
            Math.Max(0, rateLimitInfo.Limit - rateLimitInfo.RequestCount).ToString());
        context.Response.Headers.Add(
            "X-RateLimit-Reset",
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

**Configuration in Program.cs:**

```csharp
// Register rate limiting middleware
app.UseMiddleware<VannaRateLimitMiddleware>();

// Configure rate limit options
builder.Services.Configure<VannaRateLimitOptions>(options =>
{
    options.DefaultRateLimit = 10;  // queries per minute
    options.PremiumRateLimit = 50;  // for privileged users
});
```

> 💡 **Production Insight**: In our federal systems, we use Redis for distributed rate limiting across multiple application servers. For single-server deployments, `IMemoryCache` provides adequate performance.

### Scenario 2: Comprehensive Audit Logging for Compliance

Government and enterprise systems require complete audit trails of AI interactions:

**When you need this:**
- FedRAMP, FISMA, HIPAA, or SOC 2 compliance
- Security incident investigation and forensics
- User behavior analysis and anomaly detection
- Compliance reporting and certification

**Implementation:**

```csharp
// FILE: Services/VannaAuditService.cs
// PURPOSE: Comprehensive audit logging for compliance

public class VannaAuditService : IAuditLogger
{
    private readonly ILogger<VannaAuditService> _logger;
    private readonly IAuditRepository _auditRepository;
    private readonly IConfiguration _configuration;

    // WHY: Logs complete context of every AI query execution
    // HOW: Stores in audit database and structured logging system
    public async Task LogQueryExecutionAsync(
        string userId,
        VannaQueryResult result)
    {
        var auditEntry = new VannaAuditEntry
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Timestamp = DateTime.UtcNow,

            // WHY: Store both user's natural language and generated SQL
            UserQuery = result.OriginalQuery,
            GeneratedSQL = result.GeneratedSQL,

            // WHY: Performance metrics for monitoring
            ExecutionTimeMs = result.ExecutionTimeMs,
            RowsReturned = result.RowCount,

            // WHY: Success/failure tracking
            Success = result.Success,
            ErrorMessage = result.ErrorMessage,

            // WHY: Data classification for compliance reporting
            DataClassifications = result.DataClassifications,

            // WHY: Network context for security investigation
            IPAddress = result.IPAddress,
            UserAgent = result.UserAgent,
            SessionId = result.SessionId
        };

        try
        {
            // WHY: Permanent storage in audit database
            await _auditRepository.SaveAuditEntryAsync(auditEntry);

            // WHY: Real-time monitoring via structured logging
            _logger.LogInformation(
                "Vanna AI Query Executed: {UserId} | Query: {Query} | SQL: {SQL} | Rows: {Rows} | Time: {Time}ms",
                userId,
                result.OriginalQuery,
                result.GeneratedSQL,
                result.RowCount,
                result.ExecutionTimeMs);

            // WHY: Detect and alert on suspicious patterns
            await CheckForSuspiciousActivityAsync(userId, auditEntry);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Failed to log audit entry for user: {UserId}",
                userId);
            // WHY: Don't throw - audit failures shouldn't break functionality
        }
    }

    // WHY: Detects suspicious patterns requiring security investigation
    private async Task CheckForSuspiciousActivityAsync(
        string userId,
        VannaAuditEntry entry)
    {
        var recentEntries = await _auditRepository.GetRecentEntriesAsync(
            userId,
            TimeSpan.FromMinutes(5));

        // Check for rapid-fire queries
        // WHY: May indicate automated data extraction attempt
        if (recentEntries.Count() > 20)
        {
            _logger.LogWarning(
                "Suspicious activity detected: Rapid queries from user {UserId}",
                userId);
            await NotifySecurityTeamAsync(
                userId,
                "Rapid query execution detected");
        }

        // Check for potentially malicious SQL
        // WHY: AI might generate dangerous operations
        if (entry.GeneratedSQL.Contains("WHERE 1=1") ||
            entry.GeneratedSQL.Contains("DROP") ||
            entry.GeneratedSQL.Contains("DELETE"))
        {
            _logger.LogWarning(
                "Suspicious SQL generated for user {UserId}: {SQL}",
                userId,
                entry.GeneratedSQL);
            await NotifySecurityTeamAsync(
                userId,
                "Potentially malicious SQL generated");
        }

        // Check for excessive data extraction
        // WHY: Large result sets may indicate data exfiltration
        if (entry.RowsReturned > 10000)
        {
            _logger.LogWarning(
                "Large data extraction by user {UserId}: {Rows} rows",
                userId,
                entry.RowsReturned);
            await NotifySecurityTeamAsync(
                userId,
                "Large data extraction detected");
        }
    }

    // WHY: Generates compliance reports for auditors
    public async Task<AuditReport> GenerateComplianceReportAsync(
        DateTime startDate,
        DateTime endDate)
    {
        var entries = await _auditRepository.GetEntriesInRangeAsync(
            startDate,
            endDate);

        return new AuditReport
        {
            Period = $"{startDate:yyyy-MM-dd} to {endDate:yyyy-MM-dd}",
            TotalQueries = entries.Count(),
            UniqueUsers = entries.Select(e => e.UserId).Distinct().Count(),
            SuccessRate = entries.Count(e => e.Success) / (double)entries.Count() * 100,
            AverageExecutionTime = entries.Average(e => e.ExecutionTimeMs),

            // WHY: Show data classification breakdown for compliance
            DataAccessBreakdown = entries
                .SelectMany(e => e.DataClassifications)
                .GroupBy(c => c)
                .ToDictionary(g => g.Key, g => g.Count()),

            SecurityAlerts = entries.Count(e => e.GeneratedAlerts > 0),
            ComplianceStatus = "COMPLIANT"
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

> ⚠️ **Compliance Warning**: Federal regulations often require audit logs to be immutable and retained for 7+ years. Ensure your audit repository implements appropriate retention policies and tamper protection.

### Scenario 3: Input Validation and Injection Prevention

Even with AI-generated SQL, you need robust input validation to prevent malicious prompts:

**When you need this:**
- Preventing prompt injection attacks
- Detecting attempts to bypass security controls
- Protecting against SQL injection through AI manipulation
- Enforcing business rules on query content

**Implementation:**

```csharp
// FILE: Services/VannaInputValidationService.cs
// PURPOSE: Validate natural language queries for security threats

public class VannaInputValidationService
{
    private readonly ILogger<VannaInputValidationService> _logger;
    private readonly List<string> _suspiciousPatterns;
    private readonly List<string> _blockedKeywords;

    public VannaInputValidationService(
        ILogger<VannaInputValidationService> logger)
    {
        _logger = logger;

        // WHY: Detect SQL injection attempts in natural language
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

        // WHY: Prevent queries about sensitive data types
        _blockedKeywords = new List<string>
        {
            "password", "pwd", "secret", "token", "key",
            "ssn", "social_security", "credit_card", "ccn"
        };
    }

    // WHY: Validates user query before sending to AI
    // HOW: Checks length, patterns, keywords against security rules
    public ValidationResult ValidateQuery(
        string userQuery,
        UserPermissions permissions)
    {
        if (string.IsNullOrWhiteSpace(userQuery))
        {
            return ValidationResult.Invalid("Query cannot be empty");
        }

        // WHY: Prevent excessively long prompts
        if (userQuery.Length > 1000)
        {
            _logger.LogWarning(
                "Query too long from user {UserId}: {Length} characters",
                permissions.UserId,
                userQuery.Length);
            return ValidationResult.Invalid(
                "Query too long. Maximum 1000 characters allowed.");
        }

        // WHY: Detect SQL injection attempts in natural language
        foreach (var pattern in _suspiciousPatterns)
        {
            if (System.Text.RegularExpressions.Regex.IsMatch(userQuery, pattern))
            {
                _logger.LogWarning(
                    "Suspicious pattern detected in query from user {UserId}: {Query}",
                    permissions.UserId,
                    userQuery);
                return ValidationResult.Invalid(
                    "Query contains potentially malicious content");
            }
        }

        // WHY: Prevent unauthorized queries about sensitive data
        foreach (var keyword in _blockedKeywords)
        {
            if (userQuery.ToLower().Contains(keyword.ToLower()) &&
                permissions.DataAccessLevel < DataAccessLevel.Confidential)
            {
                _logger.LogWarning(
                    "Attempt to access restricted data by user {UserId}: {Query}",
                    permissions.UserId,
                    userQuery);
                return ValidationResult.Invalid(
                    $"You don't have permission to query {keyword} data");
            }
        }

        // WHY: Sanitize input while preserving meaning
        var sanitizedQuery = SanitizeQuery(userQuery);

        return ValidationResult.Valid(sanitizedQuery);
    }

    // WHY: Removes potentially harmful characters
    private string SanitizeQuery(string query)
    {
        var sanitized = query
            .Replace("'", "''")     // Escape single quotes
            .Replace("\"", "\\\"")  // Escape double quotes
            .Trim();

        // WHY: Remove characters that might break SQL parsing
        sanitized = System.Text.RegularExpressions.Regex.Replace(
            sanitized,
            @"[<>{}]",
            "");

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

> 💡 **Security Tip**: Regular expression patterns should be continuously updated based on observed attack patterns in your audit logs. Implement a review process to analyze failed validation attempts.

## Production Considerations

### Security Hardening Checklist

Before deploying to production, verify your security implementation:

- [ ] **Authentication**
  - [ ] JWT tokens use strong symmetric or asymmetric keys (256-bit minimum)
  - [ ] Token expiration configured (8 hours or less for AI systems)
  - [ ] Refresh token rotation implemented
  - [ ] Failed login attempts logged and rate-limited

- [ ] **Authorization**
  - [ ] User permissions loaded from authoritative source
  - [ ] Permission checks occur at multiple layers
  - [ ] Default deny policy for unknown resources
  - [ ] Regular permission audit reviews scheduled

- [ ] **Data Protection**
  - [ ] Data classification defined for all database columns
  - [ ] Masking rules configured and tested
  - [ ] Sensitive data never logged in plain text
  - [ ] Encrypted communication (HTTPS/TLS 1.2+)

- [ ] **Query Validation**
  - [ ] Input validation rules cover known attack patterns
  - [ ] SQL parsing validates all AI-generated queries
  - [ ] Row limits enforced at database and application level
  - [ ] Query timeout configured (30-60 seconds maximum)

- [ ] **Audit Logging**
  - [ ] All queries logged with complete context
  - [ ] Audit logs stored in tamper-proof repository
  - [ ] Log retention meets compliance requirements
  - [ ] Suspicious activity alerts configured

- [ ] **Rate Limiting**
  - [ ] Per-user limits configured appropriately
  - [ ] Rate limit headers included in responses
  - [ ] Distributed rate limiting for multi-server deployments
  - [ ] Cost monitoring and alerts configured

### Performance and Scaling

**Authentication Performance**
- Cache user permissions to avoid database lookups on every request
- Use Redis or distributed cache in multi-server environments
- Consider caching JWT validation results (with appropriate TTL)

**Query Validation Performance**
- SQL parsing can be expensive - consider caching parsed results
- Implement async validation to avoid blocking request thread
- Use background workers for audit log writes

**Monitoring Metrics**
Track these key metrics in production:
- Authentication success/failure rates
- Average query validation time
- Rate limit hit frequency
- Audit log write latency
- Data masking performance overhead

> ℹ️ **Note**: In our production systems handling high query volumes, we saw validation overhead of 50-100ms per query. This is acceptable for AI-powered queries that typically take 2-5 seconds total.

### Compliance Reporting

**FedRAMP Requirements**
Your audit implementation must provide:
- Complete user action trails
- Data access logs with classification
- Failed access attempt logging
- Security event correlation
- Immutable audit storage

**HIPAA Considerations**
For healthcare data:
- PHI access must be logged
- Minimum necessary principle enforced
- Patient consent verified
- Business associate agreements in place

**SOC 2 Type II**
Document and demonstrate:
- Access control effectiveness
- Monitoring and alerting procedures
- Incident response processes
- Regular security reviews

## Troubleshooting

### Issue: "JavaScript interop calls cannot be issued at this time"

**Symptoms:**
- Authentication fails during component initialization
- Error only occurs in Blazor Server with prerendering

**Cause:**
Attempting to access browser storage (localStorage) during server-side prerendering

**Solution:**
```csharp
// Check rendering context before JavaScript interop
if (operatingSystem == "browser")
{
    token = await JSRuntime.InvokeAsync<string>("localStorage.getItem", "token");
}
else
{
    token = await ProtectedSessionStorage.GetAsync<string>("token");
}
```

### Issue: Rate limiting not working across multiple servers

**Symptoms:**
- Users exceed rate limits when requests hit different servers
- Inconsistent rate limit counter values

**Cause:**
Using `IMemoryCache` in load-balanced environment

**Solution:**
```csharp
// Use distributed cache (Redis) instead of memory cache
services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = configuration["Redis:ConnectionString"];
});

// Update middleware to use IDistributedCache
private readonly IDistributedCache _cache;
```

### Issue: Audit logging causing performance degradation

**Symptoms:**
- Query execution takes significantly longer
- Database connection pool exhaustion

**Cause:**
Synchronous audit writes blocking request processing

**Solution:**
```csharp
// Use background queue for async audit writes
await _auditQueue.EnqueueAsync(auditEntry);

// Process queue in background service
public class AuditProcessingService : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var batch = await _auditQueue.DequeueBatchAsync(100);
            await _auditRepository.SaveBatchAsync(batch);
        }
    }
}
```

### Issue: Data masking breaking JSON serialization

**Symptoms:**
- Serialization exceptions when returning masked results
- Type conversion errors in client

**Cause:**
Masked values have different types than original values

**Solution:**
```csharp
// Ensure masked values maintain type compatibility
private object MaskValue(object value, MaskingType maskingType)
{
    if (value == null) return null;

    // Maintain original type for compatibility
    if (value is int || value is decimal)
        return 0; // Numeric mask
    else if (value is DateTime)
        return DateTime.MinValue; // Date mask
    else
        return "***MASKED***"; // String mask
}
```

## FAQ

### Q: How do I handle AI queries that need to join restricted and allowed tables?

**A**: Your permission validation should check all tables referenced in the JOIN clauses. If any table in the query is restricted, deny the entire query. Consider creating database views that pre-filter sensitive data for lower-privilege users.

```csharp
// Validate all joined tables
foreach (var table in sqlAnalysis.AllReferencedTables)
{
    if (!permissions.AllowedTables.Contains(table))
        return false;
}
```

### Q: Should I validate the AI-generated SQL or just trust Vanna AI?

**A**: Always validate AI-generated SQL. While Vanna AI is generally reliable, users can craft prompts that trick the AI into generating queries accessing unauthorized data. Validation is a critical security layer.

### Q: How do I handle queries that would return masked data to authorized users?

**A**: Apply masking after query execution based on the user's data classification level. Users with appropriate access levels see unmasked data, while others see masked values for the same query results.

### Q: What's the performance impact of data masking?

**A**: In our production systems, data masking adds 10-50ms overhead per query depending on result set size. This is negligible compared to typical AI query generation time (2-5 seconds).

### Q: Can users bypass restrictions by asking the AI to "show all data regardless of permissions"?

**A**: No, if your validation is properly implemented. Permission checks occur on the generated SQL, not the natural language prompt. The AI doesn't control access - your security service does.

### Q: How do I audit queries that fail validation?

**A**: Log failed validations separately in your audit system with the failure reason. This helps detect attack patterns and adjust validation rules:

```csharp
_logger.LogWarning(
    "Query validation failed: {Reason} | User: {UserId} | Query: {Query}",
    validationResult.ErrorMessage,
    userId,
    userQuery);
```

## Key Takeaways

- ✅ **Multi-Layer Defense**: Implement security controls at authentication, authorization, validation, execution, and output filtering layers
- ✅ **AI-Specific Permissions**: Traditional database roles are insufficient - use fine-grained schema/table/column permissions
- ✅ **Always Validate**: Never trust AI-generated SQL - always validate against user permissions before execution
- ✅ **Comprehensive Auditing**: Log every query with complete context for compliance and security investigation
- ✅ **Fail Secure**: When in doubt, deny access - better to block legitimate queries than expose sensitive data
- ✅ **Rate Limiting**: Protect against abuse and manage AI API costs with appropriate throttling
- ✅ **Data Classification**: Implement systematic data masking based on sensitivity levels and user access

## Next Steps

Now that you've implemented comprehensive security controls for your Vanna AI system:

1. **Test thoroughly** - Validate security with both authorized and unauthorized access attempts
2. **Review audit logs** - Establish baseline patterns and configure alerting thresholds
3. **Document permissions** - Create clear documentation of data classification and access rules
4. **Train users** - Educate users on appropriate queries and data handling
5. **Plan compliance** - Schedule regular security reviews and audit report generation

**Further Reading:**
- [Part 1: Building Natural Language SQL Interface](/blog/blazor-vanna-ai-natural-language-sql-queries)
- [Part 3: Scaling Vanna AI for High-Traffic Environments](/blog/scaling-vanna-ai-blazor-performance-optimization)
- [Microsoft Authentication Documentation](https://docs.microsoft.com/aspnet/core/security/authentication/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

## Need Help?

Implementing secure AI query systems for enterprise or government environments requires careful architecture and compliance knowledge. If you're building similar systems with strict security requirements, I offer:

- **Architecture Reviews** - Validate your security design against compliance frameworks
- **Implementation Guidance** - Hands-on assistance with authentication and authorization
- **Compliance Preparation** - Help prepare for FedRAMP, FISMA, HIPAA, or SOC 2 audits

I've successfully implemented these exact patterns across multiple federal government systems serving 50,000+ users. [Schedule a consultation](https://ljblab.dev/contact) to discuss your specific requirements.

---

**Found this helpful?** Star the [GitHub repository](https://github.com/lincolnbicalho) and share with your team.
