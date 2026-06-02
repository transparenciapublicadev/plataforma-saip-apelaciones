@echo off
setlocal
cd /d "%~dp0"
call gradlew.bat assembleCiudadanoDebug assembleFuncionarioDebug assembleTtaipDebug > build_verify.txt 2>&1
set EXIT_CODE=%ERRORLEVEL%
echo EXIT_CODE=%EXIT_CODE% >> build_verify.txt
exit /b %EXIT_CODE%
