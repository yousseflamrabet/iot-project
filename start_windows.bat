@echo off
cd /d "%~dp0"
set "SME_OPEN_BROWSER=1"
echo ===============================================
echo  SME Marsa Maroc - Simulation IoT v2.1
 echo  Ne fermez pas cette fenetre pendant la demonstration.
echo ===============================================
where py >nul 2>&1
if %errorlevel%==0 (
 py -3 run.py
) else (
 python run.py
)
echo.
echo Le serveur s'est arrete. Verifiez les messages ci-dessus.
pause
