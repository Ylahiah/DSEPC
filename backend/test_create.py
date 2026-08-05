import requests

url = "http://localhost:8000/api/v1/excel-exercises/"

files = {
    "workbook": ("base.xlsx", b"dummy content", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "solution_workbook": ("sol.xlsx", b"dummy content", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
}

data = {
    "name": "Test Excel Exercise 12345",
    "description": "test",
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
