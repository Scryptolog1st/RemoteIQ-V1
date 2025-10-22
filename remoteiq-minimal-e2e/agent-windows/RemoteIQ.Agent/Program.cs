using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RemoteIQ.Agent.Models;
using RemoteIQ.Agent.Services;

var builder = Host.CreateApplicationBuilder(args);

// ---- Logging (DEBUG + timestamps) ----
builder.Logging.ClearProviders();
builder.Logging.AddSimpleConsole(o => o.TimestampFormat = "HH:mm:ss ");
builder.Logging.SetMinimumLevel(LogLevel.Debug);

// ---- Services ----
builder.Services.AddSingleton<AgentConfigStore>();
builder.Services.AddSingleton(sp =>
{
    var baseUrl = Environment.GetEnvironmentVariable("REMOTEIQ_URL") ?? "http://localhost:3001";
    // FIX: pass the store to EnrollmentClient to satisfy ctor (string, AgentConfigStore)
    var store = sp.GetRequiredService<AgentConfigStore>();
    return new EnrollmentClient(baseUrl, store);
});
builder.Services.AddHostedService<WebSocketClient>(); // your WS worker

var host = builder.Build();

// ---- Ensure enrolled (uses EnrollmentClient.EnsureEnrolledAsync) ----
Console.WriteLine("RemoteIQ Windows Agent (minimal) starting...");
var secret = Environment.GetEnvironmentVariable("ENROLLMENT_SECRET") ?? "N0x1sbo55!";
var enroll = host.Services.GetRequiredService<EnrollmentClient>();
var creds = await enroll.EnsureEnrolledAsync(secret);   // FIX: call EnsureEnrolledAsync (not EnrollAsync)

Console.WriteLine($"Enrolled Agent: {creds.AgentId}");

// Run hosted services (WebSocketClient will connect and handle heartbeats/jobs)
await host.RunAsync();
