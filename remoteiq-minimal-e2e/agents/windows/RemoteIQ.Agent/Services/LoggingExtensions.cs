using Microsoft.Extensions.Logging;

namespace RemoteIQ.Agent.Services;

public static class LoggingExtensions
{
    public static void LogDebugThrottled(this ILogger logger, string key, TimeSpan period, string message, params object[] args)
    {
        if (!ThrottleState.ShouldLog(key, period)) return;
        logger.LogDebug(message, args);
    }

    private static class ThrottleState
    {
        private static readonly Dictionary<string, DateTimeOffset> Last = new();
        public static bool ShouldLog(string key, TimeSpan period)
        {
            var now = DateTimeOffset.UtcNow;
            if (!Last.TryGetValue(key, out var last) || now - last > period)
            {
                Last[key] = now;
                return true;
            }
            return false;
        }
    }
}
