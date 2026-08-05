import requests
import os

url = "http://localhost:8000/api/v1/excel-exercises/"

# Read a real excel file
excel_path = "c:/Users/MSI/Desktop/Python/DSEPC/plantilla_preguntas_dsepc.xlsx"
with open(excel_path, "rb") as f:
    real_excel = f.read()

files = {
    "workbook": ("base.xlsx", real_excel, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "solution_workbook": ("sol.xlsx", real_excel, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
}

data = {
    "name": "Test Excel Exercise Real",
    "description": "test",
    "instructions": "test",
    # The sheet inside plantilla_preguntas_dsepc.xlsx is usually 'Plantilla'
    "source_sheet_name": "Instrucciones", 
    "task_sheet_name": "Plantilla",
    "is_active": True
}

login_data = {
    "username": "admin",
    "password": "Admin12345"
}
token_res = requests.post("http://localhost:8000/api/v1/auth/login", data=login_data)
if token_res.status_code == 200:
    token = token_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    res = requests.post(url, headers=headers, data=data, files=files)
    print("STATUS:", res.status_code)
    print("RESPONSE:", res.text)
else:
    print("Failed to login", token_res.status_code, token_res.text)
