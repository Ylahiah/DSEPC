import requests

# We know the exercise ID is likely 1
url = "http://localhost:8000/api/v1/excel-exercises/1"

files = {
    "workbook": ("base.xlsx", b"dummy content", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "solution_workbook": ("sol.xlsx", b"dummy content", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
}

data = {
    "name": "Ejercicio 1 - Tabla dinámica (Nivel Básico)",
    "description": "test",
    "instructions": "test",
    "source_sheet_name": "BaseDatos",
    "task_sheet_name": "RealizaEjercicio",
    "is_active": True
}

# The route requires admin auth, let's use the default admin credentials to get a token
login_data = {
    "username": "admin",
    "password": "Admin12345"
}
token_res = requests.post("http://localhost:8000/api/v1/auth/login/access-token", data=login_data)
if token_res.status_code == 200:
    token = token_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Let's see what happens on update
    res = requests.put(url, headers=headers, data=data, files=files)
    print("STATUS:", res.status_code)
    print("RESPONSE:", res.text)
else:
    print("Failed to login", token_res.text)
