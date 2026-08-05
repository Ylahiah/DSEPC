import requests

url = "http://localhost:8000/api/v1/excel-exercises/"

base_path = "C:/Users/MSI/Desktop/Python/DSEPC/Ejercicio práctico Excel (Captura)lite.xlsx"
sol_path = "C:/Users/MSI/Desktop/Python/DSEPC/Ejercicio práctico Excel (Resuelto)lite.xlsx"

with open(base_path, "rb") as f:
    base_excel = f.read()
    
with open(sol_path, "rb") as f:
    sol_excel = f.read()

files = {
    "workbook": ("base.xlsx", base_excel, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "solution_workbook": ("sol.xlsx", sol_excel, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
}

data = {
    "name": "Ejercicio 1 - Tabla dinámica (Nivel Básico)",
    "description": "Caso practico",
    "instructions": "test",
    "source_sheet_name": "BaseDatos", 
    "task_sheet_name": "RealizaEjercicio",
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
