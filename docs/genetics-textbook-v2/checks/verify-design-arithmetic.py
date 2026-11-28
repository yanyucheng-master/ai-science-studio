"""Independent design oracles, NOT a product model or product test pass.

The one-locus distributions below are written directly from the hand tables.
Multilocus oracles are their exact independent products, not calls into web code.
"""
from fractions import Fraction as F
from itertools import product
import json

G = ("AA", "Aa", "aa")
single = {
    ("AA", "AA"): {"AA": F(1)},
    ("AA", "Aa"): {"AA": F(1, 2), "Aa": F(1, 2)},
    ("AA", "aa"): {"Aa": F(1)},
    ("Aa", "AA"): {"AA": F(1, 2), "Aa": F(1, 2)},
    ("Aa", "Aa"): {"AA": F(1, 4), "Aa": F(1, 2), "aa": F(1, 4)},
    ("Aa", "aa"): {"Aa": F(1, 2), "aa": F(1, 2)},
    ("aa", "AA"): {"Aa": F(1)},
    ("aa", "Aa"): {"Aa": F(1, 2), "aa": F(1, 2)},
    ("aa", "aa"): {"aa": F(1)},
}
x_table = {
    ("BB", "B"): {"BB": F(1, 2), "BY": F(1, 2)},
    ("BB", "b"): {"Bb": F(1, 2), "BY": F(1, 2)},
    ("Bb", "B"): {"BB": F(1, 4), "Bb": F(1, 4), "BY": F(1, 4), "bY": F(1, 4)},
    ("Bb", "b"): {"Bb": F(1, 4), "bb": F(1, 4), "BY": F(1, 4), "bY": F(1, 4)},
    ("bb", "B"): {"Bb": F(1, 2), "bY": F(1, 2)},
    ("bb", "b"): {"bb": F(1, 2), "bY": F(1, 2)},
}
counts = {"single": 0, "x": 0, "two_autosomal": 0, "autosomal_x": 0}
def check_distribution(d):
    assert sum(d.values(), F(0)) == 1
    assert all(0 < p <= 1 for p in d.values())

for (p1, p2), d in single.items():
    check_distribution(d)
    assert d == single[p2, p1]
    counts["single"] += 1
    # Phenotype changes; segregation does not.
    assert sum(v for k, v in d.items() if k != "aa") + d.get("aa", F(0)) == 1
for d in x_table.values():
    check_distribution(d)
    assert sum(v for k, v in d.items() if k.endswith("Y")) == F(1, 2)
    counts["x"] += 1
for (p1, p2), (q1, q2) in product(single, repeat=2):
    d = {(a, b): pa*pb for a, pa in single[p1, p2].items() for b, pb in single[q1, q2].items()}
    check_distribution(d)
    counts["two_autosomal"] += 1
for (p1, p2), (mom, dad) in product(single, x_table):
    d = {(a, x): pa*px for a, pa in single[p1, p2].items() for x, px in x_table[mom, dad].items()}
    check_distribution(d)
    counts["autosomal_x"] += 1

aa = single["Aa", "Aa"]
assert aa["aa"] == F(1, 4)
assert aa["Aa"] / (1-aa["aa"]) == F(2, 3)
x = x_table["Bb", "B"]
assert x["bY"] == F(1, 4)
assert x["bY"] / sum(v for k, v in x.items() if k.endswith("Y")) == F(1, 2)
joint = {(a, b): pa*pb for a, pa in aa.items() for b, pb in x.items()}
normal = {k:v for k,v in joint.items() if k[0] != "aa" and k[1] != "bY"}
assert len(normal) == 6
assert sum(normal.values()) == F(9, 16)
assert sum(p for (a,b),p in joint.items() if a=="aa" and b!="bY") == F(3, 16)
assert sum(p for (a,b),p in joint.items() if a!="aa" and b=="bY") == F(3, 16)
assert joint["aa", "bY"] == F(1, 16)
assert joint["aa", "bY"] / F(1, 2) == F(1, 8)
assert sum(counts.values()) == 150
assert 2*counts["single"] + 2*counts["x"] + counts["two_autosomal"] + counts["autosomal_x"] == 165
peas = {(a,b):pa*pb for a,pa in aa.items() for b,pb in aa.items()}
phenotypes = [sum(p for (a,b),p in peas.items() if (a!="aa")==a_dom and (b!="aa")==b_dom) for a_dom,b_dom in [(True,True),(True,False),(False,True),(False,False)]]
assert phenotypes == [F(9,16),F(3,16),F(3,16),F(1,16)]
print(json.dumps({"result":"pass", "scope":"offline hand-table design verification only", "structural_combinations":counts, "total_structural":150, "phenotype_mode_evaluations_planned":165, "six_normal_genotypes":{f"{a} X:{b}":str(p) for (a,b),p in normal.items()}, "independent_targets":["1/4","2/3","1/2 vs 1/4","9:3:3:1","9/16,3/16,3/16,1/16,1/8"]},ensure_ascii=False,indent=2))
