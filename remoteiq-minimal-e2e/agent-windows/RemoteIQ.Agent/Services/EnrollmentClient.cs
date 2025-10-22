using System.Net.Http.Json;
using System.Text.Json;
using RemoteIQ.Agent.Models;

namespace RemoteIQ.Agent.Services;

public class EnrollmentClient
{
    private readonly HttpClient _http;
    private readonly string _baseUrl;
    private readonly AgentConfigStore _store;

    public EnrollmentClient(string baseUrl, AgentConfigStore store)
    {
        _http = new HttpClient();
        _baseUrl = baseUrl.TrimEnd('/');
        _store = store;
    }

    public record EnrollReq(string EnrollmentSecret, string DeviceId, string Hostname, string Os, string Arch, string Version);
    public record EnrollResp(string AgentId, string AgentToken);

    public async Task<AgentConfig> EnsureEnrolledAsync(string enrollmentSecret)
    {
        // return cached creds if present
        var existing = await _store.LoadAsync();
        if (existing is not null && !string.IsNullOrWhiteSpace(existing.AgentId) && !string.IsNullOrWhiteSpace(existing.AgentToken))
            return existing;

        var req = new EnrollReq(
            EnrollmentSecret: enrollmentSecret,
            DeviceId: Guid.NewGuid().ToString(),
            Hostname: Environment.MachineName,
            Os: "windows",
            Arch: Environment.Is64BitProcess ? "x64" : "x86",
            Version: "0.1.0"
        );

        // enroll
        var resp = await _http.PostAsJsonAsync($"{_baseUrl}/api/agent/enroll", req);
        resp.EnsureSuccessStatusCode();

        var data = await resp.Content.ReadFromJsonAsync<EnrollResp>(new JsonSerializerOptions(JsonSerializerDefaults.Web));
        if (data is null) throw new InvalidOperationException("Empty enroll response");

        var cfg = new AgentConfig { AgentId = data.AgentId, AgentToken = data.AgentToken };
        await _store.SaveAsync(cfg);
        return cfg;
    }
}
