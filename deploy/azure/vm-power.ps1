param(
 [Parameter(Mandatory)][ValidateSet('Status','Start','Deallocate')][string]$Action,
 [Parameter(Mandatory)][string]$Subscription,
 [Parameter(Mandatory)][string]$ResourceGroup,
 [Parameter(Mandatory)][string]$Name,
 [switch]$AllowPowerChange,
 [switch]$ServicesStopped
)
$ErrorActionPreference='Stop'
if(!(Get-Command az -ErrorAction SilentlyContinue)){throw 'Azure CLI is required; no installation or login is performed'}
if($Action -ne 'Status' -and !$AllowPowerChange){throw 'Power mutation requires explicit -AllowPowerChange; no action performed'}
if($Action -eq 'Deallocate' -and !$ServicesStopped){throw 'Stop the own stack first and acknowledge with -ServicesStopped'}
if($Action -eq 'Start'){
 & az vm start --subscription $Subscription --resource-group $ResourceGroup --name $Name --only-show-errors --output none
}elseif($Action -eq 'Deallocate'){
 # 'az vm stop' or guest shutdown does not guarantee compute billing stops.
 & az vm deallocate --subscription $Subscription --resource-group $ResourceGroup --name $Name --only-show-errors --output none
}else{
 $states = & az vm get-instance-view --subscription $Subscription --resource-group $ResourceGroup --name $Name --query 'instanceView.statuses[].code' --output tsv
 $states | Where-Object { $_ -like 'PowerState/*' }
}
if($LASTEXITCODE){throw 'Azure operation failed; no retry, fallback or resource creation performed'}
