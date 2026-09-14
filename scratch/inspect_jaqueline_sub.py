import sys
import openpyxl
import json

sys.stdout.reconfigure(encoding='utf-8')

path_sub = r'C:\Users\MSI\Desktop\Python\DSEPC\backend\storage\excel_submissions\48\581_45bf7856743a4f26b7e82b5bce94d103.xlsx'
wb = openpyxl.load_workbook(path_sub, data_only=False)
wb_val = openpyxl.load_workbook(path_sub, data_only=True)

ws = wb['Evaluación Tablas Dinámicas']
ws_val = wb_val['Evaluación Tablas Dinámicas']

print("=== INSPECTING EVALUACIÓN TABLAS DINÁMICAS ===")
print("Sheet names in workbook:", wb.sheetnames)

# Let's inspect rows 17-26 (Ejercicio 1: Resumen Operativo por Mes)
print("\n--- EJERCICIO 1 (Rows 17 to 26) ---")
for r in range(17, 27):
    formulas = [ws.cell(r, c).value for c in range(1, 8)]
    values = [ws_val.cell(r, c).value for c in range(1, 8)]
    print(f"Row {r:2d} Formulas: {formulas}")
    print(f"       Values:   {values}")

# Let's inspect rows 46-57 (Ejercicio 2: Resumen por Jurisdicción)
print("\n--- EJERCICIO 2 (Rows 46 to 57) ---")
for r in range(46, 57):
    formulas = [ws.cell(r, c).value for c in range(1, 8)]
    values = [ws_val.cell(r, c).value for c in range(1, 8)]
    print(f"Row {r:2d} Formulas: {formulas}")
    print(f"       Values:   {values}")

# Let's check Hoja2, Hoja3
print("\n--- Check other sheets ---")
for sname in wb.sheetnames:
    if sname != 'BaseDatos':
        sheet = wb[sname]
        print(f"Sheet '{sname}' tables: {len(sheet.tables)}, pivot tables: {getattr(sheet, '_pivots', [])}")
