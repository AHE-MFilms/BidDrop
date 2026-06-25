import re, glob

def check_file(fname):
    content = open(fname).read()
    # Find labels with for= attribute
    for_labels = re.findall(r'<label[^>]+for=["\']([^"\']+)["\']', content)
    # Find all input/select/textarea ids
    input_ids = set(re.findall(r'(?:input|select|textarea)[^>]+id=["\']([^"\']+)["\']', content))
    issues = [lid for lid in for_labels if lid not in input_ids]
    return issues

all_issues = []
for fname in glob.glob('src/*.js') + ['index.html']:
    issues = check_file(fname)
    for i in issues:
        all_issues.append(f'{fname}: label for="{i}" has no matching input id')

print(f'Total label-for issues: {len(all_issues)}')
for i in all_issues[:30]:
    print(i)
