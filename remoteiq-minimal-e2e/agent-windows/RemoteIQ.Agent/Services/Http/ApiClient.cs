// remoteiq-minimal-e2e/agent-windows/RemoteIQ.Agent/Services/Http/ApiClient.cs
using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using RemoteIQ.Agent.Models;

namespace RemoteIQ.Agent.Services.Http
{
    public sealed class ApiClient
    {
        private readonly HttpClient _http;
        private readonly JsonSerializerOptions _json;

        public readonly struct VoidType { }

        public ApiClient(HttpClient http)
        {
            _http = http;
            _json = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                PropertyNameCaseInsensitive = true,
                WriteIndented = false
            };

            _http.DefaultRequestHeaders.Accept.Clear();
            _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        }

        public void SetBearer(string? token)
        {
            _http.DefaultRequestHeaders.Authorization =
                string.IsNullOrWhiteSpace(token) ? null : new AuthenticationHeaderValue("Bearer", token);
        }

        // ---------- Health & Enrollment ----------
        public async Task<bool> HealthAsync(CancellationToken ct = default)
        {
            using var res = await _http.GetAsync("/healthz", ct).ConfigureAwait(false);
            return res.IsSuccessStatusCode;
        }

        public async Task<EnrollResponse> EnrollAsync(EnrollRequest body, CancellationToken ct = default)
            => await PostJsonAsync<EnrollRequest, EnrollResponse>("/api/agent/enroll", body, ct).ConfigureAwait(false);

        // ---------- Ping with facts ----------
        public async Task<VoidType> PingAsync(PingRequest body, CancellationToken ct = default)
            => await PostJsonAsync<PingRequest, VoidType>("/api/agent/ping", body, ct).ConfigureAwait(false);

        // ---------- Software inventory ----------
        public async Task<VoidType> SubmitSoftwareAsync(System.Collections.Generic.IEnumerable<InstalledApp> items, CancellationToken ct = default)
        {
            var payload = new
            {
                items = items?.Select(s => new
                {
                    name = s.DisplayName,
                    version = s.Version,
                    publisher = s.Publisher,
                    installDate = s.InstallDate
                }).ToArray() ?? Array.Empty<object>()
            };

            return await PostJsonAsync<object, VoidType>("/api/agent/software", payload, ct).ConfigureAwait(false);
        }

        // ---------- Generic helpers ----------
        public async Task<T> GetJsonAsync<T>(string path, CancellationToken ct = default)
        {
            using var res = await _http.GetAsync(path, ct).ConfigureAwait(false);
            await EnsureOk(res, ct).ConfigureAwait(false);
            if (typeof(T) == typeof(VoidType)) return default!;
            await using var s = await res.Content.ReadAsStreamAsync(ct).ConfigureAwait(false);
            return (await JsonSerializer.DeserializeAsync<T>(s, _json, ct).ConfigureAwait(false))!;
        }

        public async Task<TResponse> PostJsonAsync<TRequest, TResponse>(string path, TRequest body, CancellationToken ct = default)
        {
            var content = new StringContent(JsonSerializer.Serialize(body, _json), Encoding.UTF8, "application/json");
            using var res = await _http.PostAsync(path, content, ct).ConfigureAwait(false);
            await EnsureOk(res, ct).ConfigureAwait(false);
            if (typeof(TResponse) == typeof(VoidType)) return default!;
            await using var s = await res.Content.ReadAsStreamAsync(ct).ConfigureAwait(false);
            return (await JsonSerializer.DeserializeAsync<TResponse>(s, _json, ct).ConfigureAwait(false))!;
        }

        public async Task<TResponse> PostNoBodyAsync<TResponse>(string path, CancellationToken ct = default)
        {
            using var res = await _http.PostAsync(path, content: null, ct).ConfigureAwait(false);
            await EnsureOk(res, ct).ConfigureAwait(false);
            if (typeof(TResponse) == typeof(VoidType)) return default!;
            await using var s = await res.Content.ReadAsStreamAsync(ct).ConfigureAwait(false);
            return (await JsonSerializer.DeserializeAsync<TResponse>(s, _json, ct).ConfigureAwait(false))!;
        }

        public async Task DeleteAsync(string path, CancellationToken ct = default)
        {
            using var res = await _http.DeleteAsync(path, ct).ConfigureAwait(false);
            await EnsureOk(res, ct).ConfigureAwait(false);
        }

        internal static async Task EnsureOk(HttpResponseMessage res, CancellationToken ct)
        {
            if (res.IsSuccessStatusCode) return;
            string body;
            try { body = await res.Content.ReadAsStringAsync(ct).ConfigureAwait(false); }
            catch { body = "<no body>"; }
            var status = (int)res.StatusCode;
            var reason = res.ReasonPhrase ?? "Unknown";
            throw new HttpRequestException($"HTTP {status} {reason}: {body}");
        }
    }
}
