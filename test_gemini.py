import urllib.request
import json
import urllib.error

url = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=AIzaSyFakeKeyFakeKeyFakeKeyFakeKey'
data = json.dumps({"contents":[{"parts":[{"text":"hi"}]}]}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')

try:
    response = urllib.request.urlopen(req)
    print("Success:", response.getcode())
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code, e.reason)
    print(e.read().decode('utf-8'))
except Exception as e:
    print("Error:", str(e))
