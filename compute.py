import base64

text = " '--'\n                       This is free software; see the source for copying conditions.\n                       There is NO WARRANTY, to the extent permitted by law.\n"
encoded = base64.b32encode(text.encode('utf-8')).decode('utf-8')
print("The full answer is:")
print(encoded)
