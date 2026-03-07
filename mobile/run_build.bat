@echo off
cd /d "d:\PROYECTOS-CIBERTEC\PROYECTO-SAIP-APELACIONES\plataforma-saip-apelaciones\mobile"
call gradlew.bat assembleDebug > build_verify.txt 2>&1
echo EXIT_CODE=%ERRORLEVEL% >> build_verify.txt
