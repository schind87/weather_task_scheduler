import subprocess

text = subprocess.run(['git', 'show', 'HEAD~1:app/static/js/main.js'], capture_output=True, text=True, check=True).stdout
needle = 'fieldErrorElements'
idx = text.find(needle)
print(idx)
print(text[idx-500:idx])
