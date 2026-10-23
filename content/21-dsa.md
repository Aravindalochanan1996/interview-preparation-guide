---
id: dsa
title: DSA for Coding Rounds
short: DSA
category: Architecture
order: 21
color: #7c3aed
icon: DS
summary: Big-O, core data structures and the 15 problem-solving patterns behind most coding-round questions, with JavaScript and Python templates.
---

# Beginner

## How to Tackle a Coding Interview

1. **Clarify** — restate the problem, ask about input size, edge cases (empty, duplicates, negatives), and expected output.
2. **Examples** — walk through a small example by hand.
3. **Brute force first** — state it and its complexity.
4. **Optimise** — look for a pattern (below); state the target complexity.
5. **Code** — clean, named variables, helper functions.
6. **Test** — dry-run with your example and edge cases; fix bugs.
7. **Analyse** — final time and space complexity.

> [!TIP]
> Communicate continuously. Interviewers grade problem-solving process and communication as much as the final code.

```python Two Sum: brute force first, then optimise
def two_sum_brute(nums, target):          # O(n²) time, O(1) space — say it, then improve
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]

def two_sum(nums, target):                # O(n) time, O(n) space
    seen = {}
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i
    return []

assert two_sum([2, 7, 11, 15], 9) == [0, 1]   # test with the example, then edge cases
assert two_sum([], 1) == []
```

## Big-O Complexity

Big-O describes how runtime or memory **grows** with input size `n` (worst case, ignoring constants).

| Complexity | Name | Example | n = 10⁶ feasible? |
|---|---|---|---|
| O(1) | constant | hash lookup, array index | ✅ |
| O(log n) | logarithmic | binary search | ✅ |
| O(n) | linear | single loop | ✅ |
| O(n log n) | linearithmic | sorting, heap operations × n | ✅ |
| O(n²) | quadratic | nested loops | ❌ (10¹²) |
| O(2ⁿ) | exponential | subsets, naive recursion | only n ≤ ~25 |
| O(n!) | factorial | permutations | only n ≤ ~10 |

```python
def first(xs): return xs[0]                         # O(1)
def contains(xs, t): return t in xs                 # O(n) for a list, O(1) avg for a set
def binary_search(xs, t):                           # O(log n)
    lo, hi = 0, len(xs) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if xs[mid] == t: return mid
        lo, hi = (mid + 1, hi) if xs[mid] < t else (lo, mid - 1)
    return -1
def sort_it(xs): return sorted(xs)                  # O(n log n)
def all_pairs(xs): return [(a, b) for a in xs for b in xs]   # O(n²)
```

### Rules
- Drop constants and lower terms: `O(2n + 5)` → `O(n)`.
- Sequential steps add: `O(n + m)`; nested multiply: `O(n·m)`.
- Recursion: (number of calls) × (work per call); space includes the call stack.
- Amortised: dynamic array append is O(1) amortised despite occasional O(n) resize.

### Constraint → expected complexity
n ≤ 20 → exponential/backtracking; n ≤ 10³ → O(n²); n ≤ 10⁵–10⁶ → O(n log n) or O(n); n ≥ 10⁹ → O(log n) or math.

## Arrays, Strings and Hash Maps

### Arrays & strings
Contiguous memory, O(1) index access, O(n) insert/delete in the middle. Strings are immutable in JS/Python — build with arrays and `join`.

### Hash maps / sets
Average O(1) insert/lookup/delete. The #1 tool for turning O(n²) into O(n).

```js Two Sum — O(n)
function twoSum(nums, target) {
  const seen = new Map();                 // value → index
  for (let i = 0; i < nums.length; i++) {
    const need = target - nums[i];
    if (seen.has(need)) return [seen.get(need), i];
    seen.set(nums[i], i);
  }
  return [];
}
```

```python Group anagrams
from collections import defaultdict
def group_anagrams(words):
    groups = defaultdict(list)
    for w in words:
        groups["".join(sorted(w))].append(w)   # or a 26-count tuple key
    return list(groups.values())
```

Frequency counting (`Counter`), deduplication (`Set`), and "have I seen X before?" all point to hash maps.

## Stacks, Queues and Linked Lists

### Stack (LIFO)
Use for matching brackets, undo, DFS, expression evaluation, "next greater element" (monotonic stack).
```python Valid parentheses
def is_valid(s):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for ch in s:
        if ch in pairs:
            if not stack or stack.pop() != pairs[ch]: return False
        else:
            stack.append(ch)
    return not stack
```

### Queue (FIFO)
Use for BFS, scheduling, sliding windows (`deque`).

### Linked list
O(1) insert/delete given a node, O(n) access. Common techniques: dummy head node, two pointers (fast/slow), reversing in place.
```js Reverse a linked list
function reverseList(head) {
  let prev = null, curr = head;
  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev;
}
```

# Intermediate

## Two Pointers and Sliding Window

### Two pointers
Works on **sorted arrays** or when comparing from both ends.
```python Pair with target sum in a sorted array
def pair_sum(nums, target):
    l, r = 0, len(nums) - 1
    while l < r:
        s = nums[l] + nums[r]
        if s == target: return [l, r]
        if s < target: l += 1
        else: r -= 1
    return []
```
Also: remove duplicates in place, container with most water, 3Sum (sort + two pointers), palindrome checks.

### Sliding window
For **contiguous subarrays/substrings** with a condition (max/min length, sum, distinct chars).
```js Longest substring without repeating characters — O(n)
function lengthOfLongestSubstring(s) {
  const last = new Map();
  let best = 0, left = 0;
  for (let right = 0; right < s.length; right++) {
    if (last.has(s[right]) && last.get(s[right]) >= left) left = last.get(s[right]) + 1;
    last.set(s[right], right);
    best = Math.max(best, right - left + 1);
  }
  return best;
}
```
Template: expand `right`; while the window is invalid, shrink `left`; update the answer.

### Prefix sums
`prefix[i] = sum(nums[0..i-1])` → any range sum in O(1). With a hash map of prefix counts: "number of subarrays summing to k" in O(n).

## Binary Search

Applies to sorted data **and** to any monotonic yes/no condition ("binary search on the answer").

```python
def lower_bound(nums, target):          # first index with nums[i] >= target
    lo, hi = 0, len(nums)
    while lo < hi:
        mid = (lo + hi) // 2
        if nums[mid] < target: lo = mid + 1
        else: hi = mid
    return lo
```

```python Binary search on the answer: minimum eating speed (Koko)
import math
def min_eating_speed(piles, h):
    lo, hi = 1, max(piles)
    while lo < hi:
        k = (lo + hi) // 2
        if sum(math.ceil(p / k) for p in piles) <= h: hi = k
        else: lo = k + 1
    return lo
```
Variants: rotated sorted array, find peak element, search in 2D matrix, first/last occurrence.

## Trees and Binary Search Trees

```python
class Node:
    def __init__(self, val, left=None, right=None):
        self.val, self.left, self.right = val, left, right

def max_depth(root):                     # DFS recursion
    if not root: return 0
    return 1 + max(max_depth(root.left), max_depth(root.right))

from collections import deque
def level_order(root):                   # BFS
    if not root: return []
    out, q = [], deque([root])
    while q:
        level = []
        for _ in range(len(q)):
            node = q.popleft()
            level.append(node.val)
            if node.left: q.append(node.left)
            if node.right: q.append(node.right)
        out.append(level)
    return out
```

### Traversals
- **Preorder** (root, L, R) — copy/serialize a tree.
- **Inorder** (L, root, R) — gives **sorted order in a BST**.
- **Postorder** (L, R, root) — delete/compute from children (heights, sums).
- **Level order** (BFS) — per-level problems, shortest depth.

### BST
Left < node < right → search/insert O(h): O(log n) balanced, O(n) skewed. Self-balancing: AVL, Red-Black trees (used in TreeMap, many DB indexes are B-trees).

Classic problems: validate BST (pass min/max bounds), lowest common ancestor, diameter, path sum, serialize/deserialize, kth smallest (inorder).

## Heaps and Priority Queues

A binary heap gives O(1) peek of min/max and O(log n) push/pop.

```python Top K frequent elements — O(n log k)
import heapq
from collections import Counter
def top_k_frequent(nums, k):
    heap = []
    for num, freq in Counter(nums).items():
        heapq.heappush(heap, (freq, num))
        if len(heap) > k: heapq.heappop(heap)    # keep only k largest
    return [num for _, num in heap]
```
Patterns: **top-k** (min-heap of size k), **k-way merge** (merge k sorted lists), **two heaps** (running median), scheduling (meeting rooms, task scheduler), Dijkstra.

JS has no built-in heap — be ready to implement one or explain the approach.

## Graphs: BFS, DFS and Topological Sort

Representations: adjacency list (`Map<node, neighbours[]>`) — usual; adjacency matrix for dense graphs.

```python Number of islands — DFS on a grid
def num_islands(grid):
    rows, cols = len(grid), len(grid[0])
    def dfs(r, c):
        if r < 0 or c < 0 or r >= rows or c >= cols or grid[r][c] != "1": return
        grid[r][c] = "0"                                  # mark visited
        for dr, dc in ((1,0), (-1,0), (0,1), (0,-1)): dfs(r + dr, c + dc)
    count = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == "1":
                dfs(r, c); count += 1
    return count
```

- **BFS** — shortest path in **unweighted** graphs, level-by-level spread (rotting oranges, word ladder).
- **DFS** — connectivity, cycle detection, path finding, backtracking.
- **Topological sort** (Kahn's algorithm with in-degrees, or DFS) — ordering with dependencies (course schedule, build systems); detects cycles in directed graphs.
- **Union-Find (Disjoint Set)** — connected components, cycle detection in undirected graphs, Kruskal's MST; with path compression + union by rank ≈ O(1).
- **Dijkstra** — shortest paths with non-negative weights (heap, O(E log V)); Bellman-Ford handles negative edges; Floyd-Warshall all pairs.

```python Course schedule — topological sort (Kahn)
from collections import deque, defaultdict
def can_finish(n, prereqs):
    graph, indeg = defaultdict(list), [0] * n
    for course, pre in prereqs:
        graph[pre].append(course); indeg[course] += 1
    q = deque(i for i in range(n) if indeg[i] == 0)
    taken = 0
    while q:
        node = q.popleft(); taken += 1
        for nxt in graph[node]:
            indeg[nxt] -= 1
            if indeg[nxt] == 0: q.append(nxt)
    return taken == n
```

# Advanced

## Recursion and Backtracking

Backtracking explores all candidates by building a solution step by step and **undoing** choices that fail.

```python Subsets, permutations template
def subsets(nums):
    res, path = [], []
    def backtrack(start):
        res.append(path[:])
        for i in range(start, len(nums)):
            path.append(nums[i])          # choose
            backtrack(i + 1)              # explore
            path.pop()                    # un-choose
    backtrack(0)
    return res

def permutations(nums):
    res, path, used = [], [], [False] * len(nums)
    def backtrack():
        if len(path) == len(nums): res.append(path[:]); return
        for i, x in enumerate(nums):
            if used[i]: continue
            used[i] = True; path.append(x)
            backtrack()
            path.pop(); used[i] = False
    backtrack()
    return res
```
Problems: combinations/combination sum, N-Queens, Sudoku solver, word search, generate parentheses, palindrome partitioning. Prune early to cut the search space.

## Dynamic Programming

DP applies when a problem has **overlapping subproblems** and **optimal substructure**. Steps:
1. Define the **state** (`dp[i]` = answer for the first i items / ending at i).
2. Write the **recurrence** (transition).
3. Set **base cases**.
4. Choose **top-down** (memoized recursion) or **bottom-up** (table); optimise space if only previous rows are needed.

```python Climbing stairs / Fibonacci — top-down and bottom-up
from functools import cache
@cache
def climb(n):
    return n if n <= 2 else climb(n - 1) + climb(n - 2)

def climb_iter(n):
    a, b = 1, 1
    for _ in range(n): a, b = b, a + b
    return a
```

```python Coin change — minimum coins (unbounded knapsack)
def coin_change(coins, amount):
    dp = [0] + [float("inf")] * amount
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a: dp[a] = min(dp[a], dp[a - c] + 1)
    return dp[amount] if dp[amount] != float("inf") else -1
```

```python Longest common subsequence — 2D DP
def lcs(a, b):
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            dp[i][j] = dp[i-1][j-1] + 1 if a[i-1] == b[j-1] else max(dp[i-1][j], dp[i][j-1])
    return dp[-1][-1]
```

### DP families
| Family | Examples |
|---|---|
| 1D linear | climbing stairs, house robber, decode ways, max subarray (Kadane) |
| Knapsack | 0/1 knapsack, partition equal subset sum, coin change, target sum |
| Strings (2D) | LCS, edit distance, longest palindromic substring/subsequence, regex matching |
| Grid | unique paths, min path sum, maximal square |
| Intervals / partition | burst balloons, matrix chain multiplication |
| Subsequence | longest increasing subsequence (O(n log n) with patience sorting) |
| State machine | stock buy/sell with cooldown/fees |

```js Kadane's algorithm — maximum subarray sum, O(n)
function maxSubArray(nums) {
  let best = nums[0], curr = nums[0];
  for (let i = 1; i < nums.length; i++) {
    curr = Math.max(nums[i], curr + nums[i]);
    best = Math.max(best, curr);
  }
  return best;
}
```

## Greedy, Intervals and Monotonic Stack

### Greedy
Make the locally optimal choice at each step — works when you can prove it leads to a global optimum (exchange argument). Examples: jump game, gas station, assign cookies, activity selection, Huffman coding.

### Intervals
Usually **sort by start** (or end) first.
```python Merge intervals
def merge(intervals):
    intervals.sort(key=lambda x: x[0])
    out = [intervals[0]]
    for start, end in intervals[1:]:
        if start <= out[-1][1]: out[-1][1] = max(out[-1][1], end)
        else: out.append([start, end])
    return out
```
Meeting rooms II: sort starts and ends separately (or min-heap of end times) to count overlaps.

### Monotonic stack
Keep a stack in increasing/decreasing order to find the **next greater/smaller element** in O(n): daily temperatures, largest rectangle in histogram, trapping rain water.
```js Daily temperatures
function dailyTemperatures(t) {
  const res = new Array(t.length).fill(0), stack = [];   // indices, temps decreasing
  for (let i = 0; i < t.length; i++) {
    while (stack.length && t[i] > t[stack.at(-1)]) {
      const j = stack.pop();
      res[j] = i - j;
    }
    stack.push(i);
  }
  return res;
}
```

## Tries, Bit Manipulation and Design Problems

### Trie (prefix tree)
Efficient prefix lookups: autocomplete, word search II, spell check. Insert/search O(length of word).
```python
class Trie:
    def __init__(self): self.root = {}
    def insert(self, word):
        node = self.root
        for ch in word: node = node.setdefault(ch, {})
        node["$"] = True
    def starts_with(self, prefix):
        node = self.root
        for ch in prefix:
            if ch not in node: return False
            node = node[ch]
        return True
```

### Bit manipulation
`x & 1` (odd?), `x & (x - 1)` (clear lowest set bit → count bits / power of two check), XOR tricks (`a ^ a = 0` → single number), masks for subsets.

### LRU cache — a favourite design question
O(1) `get`/`put` using a **hash map + doubly linked list** (or an ordered map):
```js
class LRUCache {
  constructor(capacity) { this.capacity = capacity; this.map = new Map(); } // Map keeps insertion order
  get(key) {
    if (!this.map.has(key)) return -1;
    const val = this.map.get(key);
    this.map.delete(key); this.map.set(key, val);       // mark as most recent
    return val;
  }
  put(key, val) {
    this.map.delete(key);
    this.map.set(key, val);
    if (this.map.size > this.capacity) this.map.delete(this.map.keys().next().value); // evict LRU
  }
}
```

## Pattern Recognition Cheat Sheet

| If the problem mentions… | Think… |
|---|---|
| sorted array, find pair/target | two pointers, binary search |
| contiguous subarray/substring with constraint | sliding window, prefix sums |
| "top/smallest/largest k", streaming median | heap |
| all combinations / permutations / subsets | backtracking |
| optimal (max/min/count ways) with overlapping choices | dynamic programming |
| tree paths, depths, ancestors | DFS recursion (pre/in/post order) |
| shortest path, minimum steps (unweighted) | BFS |
| dependencies / ordering | topological sort |
| connected components, grouping | Union-Find or DFS |
| next greater/smaller element | monotonic stack |
| prefix/word lookup | trie |
| overlapping intervals, scheduling | sort + sweep / heap |
| minimise the maximum / feasible threshold | binary search on the answer |
| frequency / duplicates / "seen before" | hash map / set |
| linked list cycle / middle | fast & slow pointers |

```python Prefix sums: "count subarrays summing to k"
from collections import defaultdict
def subarray_sum(nums, k):
    count, running, seen = 0, 0, defaultdict(int)
    seen[0] = 1
    for x in nums:
        running += x
        count += seen[running - k]     # some earlier prefix makes a sum of k
        seen[running] += 1
    return count
assert subarray_sum([1, 1, 1], 2) == 2
```
```python Heap: "k largest"
import heapq
heapq.nlargest(3, [5, 1, 9, 7, 3])     # [9, 7, 5]  O(n log k)
```

### Must-practise list (≈ 40 problems)
Two Sum · Valid Anagram · Group Anagrams · Top K Frequent · Product of Array Except Self · Longest Consecutive Sequence · Valid Palindrome · 3Sum · Container With Most Water · Best Time to Buy/Sell Stock · Longest Substring Without Repeating · Minimum Window Substring · Valid Parentheses · Min Stack · Daily Temperatures · Binary Search · Search in Rotated Array · Koko Eating Bananas · Reverse Linked List · Merge Two Sorted Lists · Linked List Cycle · LRU Cache · Invert Binary Tree · Max Depth · Same Tree · Level Order · Validate BST · LCA of BST · Kth Smallest in BST · Number of Islands · Clone Graph · Course Schedule · Rotting Oranges · Kth Largest Element · Merge K Sorted Lists · Subsets · Combination Sum · Word Search · Climbing Stairs · House Robber · Coin Change · Longest Increasing Subsequence · Longest Common Subsequence · Merge Intervals · Implement Trie.

# Interview Questions

## Beginner

### What is Big-O notation?
A way to describe how an algorithm's time or space requirements grow as input size grows, focusing on the dominant term in the worst case and ignoring constants. It lets you compare algorithms independent of hardware.

```python
def f(n):
    total = 0
    for i in range(n):          # n
        total += i
    for i in range(n):          # n × n
        for j in range(n):
            total += j
    return total                # O(n + n²) = O(n²) — keep the dominant term, drop constants
```

### Array vs linked list?
Arrays store elements contiguously with O(1) index access and cache-friendly iteration, but O(n) insertions/deletions in the middle. Linked lists allow O(1) insertion/deletion given a node but O(n) access and extra memory per node for pointers.

```python
class Node:
    def __init__(self, val, nxt=None): self.val, self.next = val, nxt

arr = [1, 2, 3]
arr[1]                 # O(1) index
arr.insert(0, 0)       # O(n) shift

head = Node(1, Node(2, Node(3)))
head = Node(0, head)   # O(1) insert at head
def get(head, i):      # O(n) to reach index i
    while i: head, i = head.next, i - 1
    return head.val
```

### How does a hash map work?
It computes a hash of the key to pick a bucket in an array, storing key-value pairs there. Collisions are handled with chaining (lists per bucket) or open addressing (probing). With a good hash function and resizing to keep the load factor low, operations are O(1) on average, O(n) worst case.

```python
class HashMap:
    def __init__(self, cap=8): self.buckets = [[] for _ in range(cap)]; self.size = 0
    def _bucket(self, key): return self.buckets[hash(key) % len(self.buckets)]
    def put(self, key, val):
        b = self._bucket(key)
        for i, (k, _) in enumerate(b):
            if k == key: b[i] = (key, val); return
        b.append((key, val)); self.size += 1                    # chaining handles collisions
        if self.size / len(self.buckets) > 0.75: self._resize()  # keep load factor low
    def get(self, key):
        return next((v for k, v in self._bucket(key) if k == key), None)
    def _resize(self):
        items = [kv for b in self.buckets for kv in b]
        self.buckets = [[] for _ in range(len(self.buckets) * 2)]; self.size = 0
        for k, v in items: self.put(k, v)
```

### Stack vs queue?
A stack is LIFO (last in, first out): push/pop at the top — used for recursion, undo, DFS, parsing. A queue is FIFO (first in, first out): enqueue at the back, dequeue from the front — used for BFS, scheduling and buffering.

```python
from collections import deque
stack = []; stack.append(1); stack.append(2); stack.pop()      # 2 (LIFO)
queue = deque(); queue.append(1); queue.append(2); queue.popleft()   # 1 (FIFO)

def is_valid_parens(s):                 # classic stack problem
    pairs, st = {")": "(", "]": "[", "}": "{"}, []
    for ch in s:
        if ch in pairs:
            if not st or st.pop() != pairs[ch]: return False
        else: st.append(ch)
    return not st
assert is_valid_parens("([]{})") and not is_valid_parens("(]")
```

### What is the time complexity of common sorting algorithms?
Merge sort O(n log n) stable, extra O(n) space. Quick sort O(n log n) average, O(n²) worst, in place. Heap sort O(n log n) in place, not stable. Insertion sort O(n²) but fast for small/nearly sorted arrays. Built-in sorts use hybrids like Timsort (Python, JS V8) — O(n log n), stable.

```python Merge sort — O(n log n), stable
def merge_sort(xs):
    if len(xs) <= 1: return xs
    mid = len(xs) // 2
    left, right = merge_sort(xs[:mid]), merge_sort(xs[mid:])
    out, i, j = [], 0, 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]: out.append(left[i]); i += 1
        else: out.append(right[j]); j += 1
    return out + left[i:] + right[j:]
assert merge_sort([5, 2, 9, 1]) == [1, 2, 5, 9]
```

## Intermediate

### When do you use BFS vs DFS?
BFS explores level by level and finds the shortest path in unweighted graphs; it uses a queue and more memory for wide graphs. DFS goes deep first using recursion/stack; it's good for exhaustive search, connectivity, cycle detection, topological sort and backtracking.

```python
from collections import deque
def bfs_shortest(graph, start, goal):           # shortest path in an unweighted graph
    q, dist = deque([start]), {start: 0}
    while q:
        node = q.popleft()
        if node == goal: return dist[node]
        for nb in graph[node]:
            if nb not in dist: dist[nb] = dist[node] + 1; q.append(nb)
    return -1

def dfs_count_islands(grid):                    # explore fully, connected components
    rows, cols, seen = len(grid), len(grid[0]), set()
    def dfs(r, c):
        if not (0 <= r < rows and 0 <= c < cols) or grid[r][c] == "0" or (r, c) in seen: return
        seen.add((r, c)); [dfs(r + dr, c + dc) for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))]
    return sum(1 for r in range(rows) for c in range(cols) if grid[r][c] == "1" and (r, c) not in seen and not dfs(r, c))
```

### What is the sliding window technique?
Maintaining a window over a contiguous range of an array or string, expanding the right edge and shrinking the left edge when a constraint is violated, so each element is processed a constant number of times — turning O(n²) brute force into O(n).

```python Longest substring without repeating characters — O(n)
def longest_unique(s):
    last, left, best = {}, 0, 0
    for right, ch in enumerate(s):
        if ch in last and last[ch] >= left:
            left = last[ch] + 1            # shrink past the duplicate
        last[ch] = right
        best = max(best, right - left + 1)
    return best
assert longest_unique("abcabcbb") == 3
```

### How do you detect a cycle in a linked list?
Floyd's tortoise and hare: move one pointer by one step and another by two; if they meet, there's a cycle. To find the start, reset one pointer to the head and move both one step at a time until they meet. O(n) time, O(1) space.

```python
def detect_cycle_start(head):
    slow = fast = head
    while fast and fast.next:
        slow, fast = slow.next, fast.next.next
        if slow is fast:                   # they met → cycle exists
            slow = head
            while slow is not fast:
                slow, fast = slow.next, fast.next
            return slow                    # start of the cycle
    return None
```

### What is a heap and where is it used?
A complete binary tree where each parent is ≤ (min-heap) or ≥ (max-heap) its children, stored in an array. It offers O(1) access to the min/max and O(log n) insert/extract. Used for priority queues, top-k problems, scheduling, Dijkstra and median maintenance.

```python
import heapq
h = []
for x in [5, 1, 8, 3]: heapq.heappush(h, x)   # O(log n) each
heapq.heappop(h)                               # 1 — min in O(log n)

def k_closest(points, k):                      # max-heap of size k via negation
    heap = []
    for x, y in points:
        heapq.heappush(heap, (-(x * x + y * y), x, y))
        if len(heap) > k: heapq.heappop(heap)
    return [(x, y) for _, x, y in heap]
```

### Explain binary search and its common pitfalls.
Repeatedly halve a sorted search space by comparing the middle element with the target — O(log n). Pitfalls: off-by-one errors in bounds, infinite loops when `lo`/`hi` don't move, integer overflow computing `mid` in some languages, and choosing the right condition for first/last occurrence. It also applies to monotonic predicate problems.

```python Lower bound: first index with xs[i] >= target
def lower_bound(xs, target):
    lo, hi = 0, len(xs)                  # hi is exclusive
    while lo < hi:
        mid = lo + (hi - lo) // 2        # no overflow in fixed-width languages
        if xs[mid] < target: lo = mid + 1
        else: hi = mid                   # never mid - 1 here, or you skip the answer
    return lo
assert lower_bound([1, 3, 3, 5], 3) == 1
assert lower_bound([1, 3, 3, 5], 6) == 4
```

## Advanced

### Memoization vs tabulation?
Both are DP. Memoization (top-down) recursively solves subproblems and caches results — easy to write from the recurrence, computes only needed states, but uses recursion stack. Tabulation (bottom-up) fills a table iteratively in dependency order — no recursion overhead and enables space optimisation.

```python
from functools import lru_cache
@lru_cache(maxsize=None)                 # top-down memoization
def climb(n):
    return 1 if n <= 1 else climb(n - 1) + climb(n - 2)

def climb_tab(n):                        # bottom-up tabulation, O(1) space
    a, b = 1, 1
    for _ in range(n - 1): a, b = b, a + b
    return b
assert climb(10) == climb_tab(10) == 89
```

### How do you recognise a dynamic programming problem?
It asks for an optimum (min/max), a count of ways, or feasibility, and decisions at each step affect later options; brute-force recursion recomputes the same subproblems (overlapping subproblems) and optimal answers build from optimal sub-answers (optimal substructure).

```python Coin change: "minimum coins" = optimum + overlapping subproblems
def coin_change(coins, amount):
    INF = float("inf")
    dp = [0] + [INF] * amount                    # dp[a] = min coins for amount a
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a: dp[a] = min(dp[a], dp[a - c] + 1)
    return dp[amount] if dp[amount] != INF else -1
assert coin_change([1, 2, 5], 11) == 3
```

### How would you implement an LRU cache with O(1) operations?
Combine a hash map from key to node with a doubly linked list ordered by recency. `get` looks up the node and moves it to the front; `put` inserts/updates at the front and, if over capacity, removes the tail node and its map entry. In JS/Python, an insertion-ordered Map/OrderedDict achieves the same.

```python
class Node:
    __slots__ = ("k", "v", "prev", "next")
    def __init__(self, k=0, v=0): self.k, self.v, self.prev, self.next = k, v, None, None

class LRUCache:
    def __init__(self, cap):
        self.cap, self.map = cap, {}
        self.head, self.tail = Node(), Node()          # sentinels
        self.head.next, self.tail.prev = self.tail, self.head
    def _remove(self, n): n.prev.next, n.next.prev = n.next, n.prev
    def _add_front(self, n):
        n.prev, n.next = self.head, self.head.next
        self.head.next.prev = n; self.head.next = n
    def get(self, k):
        if k not in self.map: return -1
        n = self.map[k]; self._remove(n); self._add_front(n); return n.v
    def put(self, k, v):
        if k in self.map: self._remove(self.map[k])
        n = self.map[k] = Node(k, v); self._add_front(n)
        if len(self.map) > self.cap:
            lru = self.tail.prev; self._remove(lru); del self.map[lru.k]
```

### Explain Dijkstra's algorithm.
It finds shortest paths from a source in a graph with non-negative edge weights. Start with distance 0 for the source, use a min-heap to repeatedly extract the closest unvisited node, and relax its edges (update neighbour distances if shorter). Complexity O((V + E) log V) with a binary heap. Negative weights require Bellman-Ford.

```python
import heapq
def dijkstra(graph, src):                     # graph: {u: [(v, w), ...]}, w >= 0
    dist = {src: 0}
    pq = [(0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist.get(u, float("inf")): continue    # stale entry
        for v, w in graph[u]:
            nd = d + w
            if nd < dist.get(v, float("inf")):
                dist[v] = nd
                heapq.heappush(pq, (nd, v))
    return dist                                # O((V + E) log V)
```

### What is Union-Find and what optimisations make it fast?
A disjoint-set structure supporting `find` (which set an element belongs to) and `union` (merge sets). Path compression flattens trees during find, and union by rank/size attaches smaller trees under larger ones, giving near-constant amortised time (inverse Ackermann). Used for connected components, cycle detection and Kruskal's MST.

```python
class DSU:
    def __init__(self, n): self.parent, self.rank = list(range(n)), [0] * n
    def find(self, x):
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])    # path compression
        return self.parent[x]
    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra == rb: return False                          # already connected (cycle!)
        if self.rank[ra] < self.rank[rb]: ra, rb = rb, ra
        self.parent[rb] = ra                               # union by rank
        self.rank[ra] += self.rank[ra] == self.rank[rb]
        return True
```

# Scenario Questions

## Intermediate

### You need the top 10 most frequent search terms from a stream of millions of queries per hour. Which data structures do you use?
- A **hash map** for counts, plus a **min-heap of size k**: O(n log k).
- For an unbounded stream with limited memory, an approximate **Count-Min Sketch** plus a heap (heavy hitters).
- For a sliding window, bucket counts per minute and expire old buckets.

```python
from collections import Counter
import heapq
counts = Counter()
for q in query_stream():
    counts[q.lower()] += 1
top10 = heapq.nlargest(10, counts.items(), key=lambda kv: kv[1])   # O(n log k)
# Bounded memory: Count-Min Sketch for counts + a size-k heap of candidates
```

### An autocomplete feature must suggest words by prefix as the user types. What structure fits?
A **trie** (prefix tree). Each node can keep the top-k completions, ranked by frequency, so suggestions come back in O(prefix length). For huge vocabularies, use a compressed trie (radix tree) or a sorted array with binary search on the prefix range.

```python
class TrieNode:
    def __init__(self): self.children, self.top = {}, []    # top: best completions at this prefix

class Trie:
    def __init__(self, k=5): self.root, self.k = TrieNode(), k
    def insert(self, word, freq):
        node = self.root
        for ch in word:
            node = node.children.setdefault(ch, TrieNode())
            node.top = sorted(node.top + [(freq, word)], reverse=True)[: self.k]
    def suggest(self, prefix):
        node = self.root
        for ch in prefix:
            if ch not in node.children: return []
            node = node.children[ch]
        return [w for _, w in node.top]                      # O(len(prefix))
```

## Advanced

### You need to detect whether a user has seen an article before, across billions of articles, with little memory. What do you use?
A **Bloom filter**. It's a bit array with k hash functions: "definitely not seen" is always correct, and "maybe seen" has a tunable false-positive rate. It can't delete entries (use a counting Bloom or cuckoo filter if you need that). Back it with an exact store when a false positive would be costly.

```python
import hashlib, math
class BloomFilter:
    def __init__(self, n, fp=0.01):
        self.m = int(-n * math.log(fp) / (math.log(2) ** 2))   # bits
        self.k = max(1, int(self.m / n * math.log(2)))         # hash functions
        self.bits = bytearray(self.m // 8 + 1)
    def _idx(self, item):
        h = hashlib.sha256(item.encode()).digest()
        a, b = int.from_bytes(h[:8], "big"), int.from_bytes(h[8:16], "big")
        return [(a + i * b) % self.m for i in range(self.k)]
    def add(self, item):
        for i in self._idx(item): self.bits[i // 8] |= 1 << (i % 8)
    def might_contain(self, item):
        return all(self.bits[i // 8] & (1 << (i % 8)) for i in self._idx(item))
# 1B items at 1% false positives ≈ 1.2 GB of bits instead of storing every id
```

# Tricky Questions

## Beginner

### What's the time complexity? `for (let i = 1; i < n; i *= 2) for (let j = 0; j < i; j++) work();`
**O(n)**, not O(n log n). The inner loop runs 1 + 2 + 4 + … + n/2 times, a geometric series that sums to less than 2n.

```js
let ops = 0, n = 1 << 20;
for (let i = 1; i < n; i *= 2) for (let j = 0; j < i; j++) ops++;
console.log(ops, n);   // 1048575 1048576 → ops < n, so O(n)
```

### Is this binary search correct? `mid = (lo + hi) / 2`
In languages with fixed-width integers (Java, C++), `lo + hi` can **overflow** for large indices. Use `lo + (hi - lo) / 2`. Also check the loop condition (`lo <= hi` versus `lo < hi`) and the updates (`hi = mid - 1` versus `hi = mid`). Mixing them up causes infinite loops or skipped elements.

```java
int lo = 1_500_000_000, hi = 2_000_000_000;
int bad = (lo + hi) / 2;          // overflow → negative number
int good = lo + (hi - lo) / 2;    // 1_750_000_000
int alsoGood = (lo + hi) >>> 1;   // unsigned shift
```

## Intermediate

### What's the complexity of `str += char` inside a loop of n iterations in Java or Python?
It can be **O(n²)**, because strings are immutable and each concatenation copies the whole string. Use `StringBuilder` (Java) or `''.join(parts)` (Python). CPython sometimes optimises in-place `+=`, but don't rely on it.

```python
parts = []
for ch in chars:
    parts.append(ch)          # O(1) amortised
s = "".join(parts)            # one O(n) copy
```
```java
StringBuilder sb = new StringBuilder();
for (char c : chars) sb.append(c);   // O(n) total instead of O(n²)
String s = sb.toString();
```

### Why can recursive Fibonacci with memoization still crash for n = 100,000?
Recursion depth: each call adds a stack frame, so you hit Python's recursion limit or a stack overflow. Use the **bottom-up** iterative version (two variables, O(1) space), or increase the limit and accept the risk.

```python
import sys
from functools import lru_cache
@lru_cache(None)
def fib(n): return n if n < 2 else fib(n - 1) + fib(n - 2)
# fib(100_000) → RecursionError (default limit ~1000)

def fib_iter(n):
    a, b = 0, 1
    for _ in range(n): a, b = b, a + b
    return a                 # O(n) time, O(1) space, no stack growth
```

## Advanced

### Quicksort is O(n log n) on average. When does it degrade, and how do libraries avoid it?
It degrades to **O(n²)** when pivots are consistently bad: already sorted input with a first or last-element pivot, or many duplicates. Libraries use random or median-of-three pivots, three-way partitioning for duplicates, and **introsort** (which falls back to heapsort past a recursion depth). Java sorts objects with TimSort, which is stable and O(n log n) in the worst case.

```python
import random
def quicksort(xs):
    if len(xs) <= 1: return xs
    pivot = random.choice(xs)                         # random pivot defeats sorted input
    lt = [x for x in xs if x < pivot]
    eq = [x for x in xs if x == pivot]                # 3-way partition handles duplicates
    gt = [x for x in xs if x > pivot]
    return quicksort(lt) + eq + quicksort(gt)
# Library sorts: Python's Timsort (merge-based), C++ introsort (switches to heapsort on deep recursion)
```
