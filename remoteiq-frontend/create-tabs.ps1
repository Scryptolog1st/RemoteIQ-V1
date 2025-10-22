# PowerShell script to create empty .tsx files for each administration tab.
# Run this from the root of your project.

# Define the target directory for the new component files.
$targetDir = "app\administration\tabs"

# An array containing the PascalCase names for each tab component.
$tabComponentNames = @(
    "UsersTab",
    "RolesTab",
    "CompanyTab",
    "BillingTab",
    "InvoicesTab",
    "SmtpTab",
    "SystemTab",
    "SsoTab",
    "DatabaseTab",
    "StorageTab",
    "BackupsTab",
    "TemplatesTab",
    "AuditLogsTab",
    "ApiTab",
    "FlagsTab",
    "BrandingTab",
    "LocalizationTab",
    "NotificationsTab",
    "SecurityPoliciesTab",
    "ComplianceTab",
    "IntegrationsTab",
    "AgentsTab",
    "WorkflowsTab",
    "ImportExportTab",
    "CustomFieldsTab",
    "SubscriptionTab",
    "ClientPortalTab",
    "SlaTab",
    "TicketingTab",
    "SecretsTab",
    "SessionsTab",
    "RolesMatrixTab",
    "MigrationsTab",
    "ReportsTab",
    "SupportTab"
)

# Check if the target directory exists, though the user said it does.
if (-not (Test-Path $targetDir)) {
    Write-Host "Target directory '$targetDir' not found. Please create it first."
    exit
}

# Loop through the array and create an empty .tsx file for each name.
foreach ($componentName in $tabComponentNames) {
    $filePath = Join-Path $targetDir "$($componentName).tsx"
    
    # -Force will overwrite the file if it already exists. Remove it if you don't want that behavior.
    New-Item -Path $filePath -ItemType File -Force | Out-Null
    
    Write-Host "Created: $filePath"
}

Write-Host "`n✅ All tab component files have been created successfully in '$targetDir'."
