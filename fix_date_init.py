import re

with open('app.js', 'r') as f:
    content = f.read()

target = """    dateInput.value = today;
    const endDateInput = document.getElementById('forecast-end-date');
    if (endDateInput) endDateInput.value = endStr;"""

replacement = """    // Leave date inputs blank by default
    dateInput.value = "";
    const endDateInput = document.getElementById('forecast-end-date');
    if (endDateInput) endDateInput.value = "";"""

if target in content:
    with open('app.js', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Fixed initial date inputs.")
else:
    print("Could not find initial date assignment in app.js")
