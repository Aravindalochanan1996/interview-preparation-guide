---
id: ai-ml
title: AI & Machine Learning
short: AI / ML
category: Artificial Intelligence
order: 18
color: #ff6f00
icon: ML
summary: ML fundamentals, the ML workflow, classic algorithms, evaluation metrics, overfitting, neural networks, deep learning (CNN, RNN, Transformers) and MLOps.
---

# Beginner

## AI, ML and Deep Learning — The Big Picture

- **Artificial Intelligence** — machines performing tasks that normally require human intelligence.
- **Machine Learning** — a subset of AI: systems **learn patterns from data** rather than following hand-written rules.
- **Deep Learning** — a subset of ML using **multi-layer neural networks**, excelling on unstructured data (images, text, audio).
- **Generative AI** — models that *create* new content (text, images, code) — e.g., LLMs, diffusion models.

### Traditional programming vs ML
```text
Traditional:  Rules + Data  → Answers
ML:           Data + Answers → Rules (a model)
```

### Types of learning

| Type | Data | Examples |
|---|---|---|
| **Supervised** | labelled (input → known output) | spam detection, price prediction |
| **Unsupervised** | unlabelled | customer segmentation, anomaly detection |
| **Semi-/Self-supervised** | few labels / labels derived from data itself | LLM pre-training (predict next token) |
| **Reinforcement** | rewards from interacting with an environment | games, robotics, RLHF for LLMs |

### Supervised task types
- **Regression** — predict a continuous number (house price).
- **Classification** — predict a category (spam / not spam; binary vs multi-class vs multi-label).

## The Machine Learning Workflow

1. **Define the problem** and success metric (business + ML metric).
2. **Collect data**.
3. **Explore (EDA)** — distributions, missing values, outliers, correlations, class imbalance.
4. **Prepare data** — cleaning, feature engineering, encoding, scaling.
5. **Split** — train / validation / test (e.g., 70/15/15) — or cross-validation.
6. **Train** baseline then better models.
7. **Evaluate** on validation; tune hyperparameters.
8. **Final test** on held-out test set (once!).
9. **Deploy**, then **monitor** for drift and retrain.

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report

df = pd.read_csv("churn.csv")
X, y = df.drop(columns="churned"), df["churned"]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)

model = RandomForestClassifier(n_estimators=300, random_state=42)
model.fit(X_train, y_train)
print(classification_report(y_test, model.predict(X_test)))
```

### Key vocabulary
**Features** (inputs, X), **label/target** (y), **model** (learned function), **parameters** (learned weights), **hyperparameters** (settings you choose: learning rate, tree depth), **training**, **inference** (prediction).

## Data Preparation and Feature Engineering

### Handling missing values
Drop rows/columns, impute (mean/median/mode, KNN, model-based), or add a "was missing" indicator.

### Encoding categorical variables
- **One-hot encoding** — nominal categories (colour).
- **Ordinal/label encoding** — ordered categories (low < medium < high).
- **Target encoding / embeddings** — high-cardinality categories.

### Feature scaling
- **Standardization** (z-score): `(x − mean) / std` — for linear models, SVM, neural nets, PCA.
- **Normalization** (min-max to [0, 1]).
- Tree-based models don't need scaling.

### Avoid data leakage
Fit scalers/imputers/encoders **only on training data**, then apply to validation/test. Use scikit-learn **Pipelines**:
```python
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression

pre = ColumnTransformer([
    ("num", Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]), ["age", "income"]),
    ("cat", OneHotEncoder(handle_unknown="ignore"), ["city", "plan"]),
])
clf = Pipeline([("pre", pre), ("model", LogisticRegression(max_iter=1000))]).fit(X_train, y_train)
```
Other leakage: features that wouldn't be available at prediction time (e.g., "refund_issued" when predicting fraud), duplicates across splits, and random splits on time-series data (use time-based splits).

## Classic Algorithms

| Algorithm | Type | Idea | Notes |
|---|---|---|---|
| **Linear Regression** | regression | fit a line minimising squared error | interpretable; assumes linearity |
| **Logistic Regression** | classification | linear model + sigmoid → probability | strong baseline, interpretable |
| **K-Nearest Neighbors** | both | predict from the k closest training points | needs scaling; slow at inference |
| **Decision Tree** | both | split data by feature thresholds (Gini/entropy) | interpretable; overfits easily |
| **Random Forest** | both | many trees on bootstrapped data + random features, average (bagging) | robust, little tuning |
| **Gradient Boosting** (XGBoost, LightGBM, CatBoost) | both | trees added sequentially to fix previous errors | often best on tabular data |
| **SVM** | both | maximum-margin hyperplane, kernels for non-linearity | good for small/medium data |
| **Naive Bayes** | classification | Bayes theorem with independence assumption | fast; text classification baseline |
| **K-Means** | clustering | assign points to k centroids, iterate | choose k with elbow/silhouette |
| **DBSCAN** | clustering | density-based clusters, finds outliers | no need to pick k |
| **PCA** | dimensionality reduction | project onto directions of max variance | visualisation, compression |

```python
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.cluster import KMeans
from sklearn.model_selection import cross_val_score

models = {
    "logreg": LogisticRegression(max_iter=1000),
    "tree": DecisionTreeClassifier(max_depth=5),
    "forest": RandomForestClassifier(n_estimators=300, n_jobs=-1),
    "gbm": GradientBoostingClassifier(),
    "knn": KNeighborsClassifier(n_neighbors=7),
}
for name, m in models.items():
    print(name, cross_val_score(m, X, y, cv=5, scoring="f1").mean())
segments = KMeans(n_clusters=4, n_init="auto").fit_predict(X_customers)   # unsupervised
```

# Intermediate

## Evaluation Metrics

```python
from sklearn.metrics import confusion_matrix, classification_report, roc_auc_score, average_precision_score, mean_absolute_error, mean_squared_error
y_pred = model.predict(X_test)
y_prob = model.predict_proba(X_test)[:, 1]
print(confusion_matrix(y_test, y_pred))            # [[TN FP] [FN TP]]
print(classification_report(y_test, y_pred))        # precision, recall, f1 per class
print("ROC-AUC", roc_auc_score(y_test, y_prob), "PR-AUC", average_precision_score(y_test, y_prob))
# Regression
print("MAE", mean_absolute_error(y_true, y_hat), "RMSE", mean_squared_error(y_true, y_hat) ** 0.5)
```

### Classification — the confusion matrix

| | Predicted Positive | Predicted Negative |
|---|---|---|
| **Actual Positive** | TP | FN (Type II error) |
| **Actual Negative** | FP (Type I error) | TN |

- **Accuracy** = (TP + TN) / total — misleading on imbalanced data (99% "not fraud" model is useless).
- **Precision** = TP / (TP + FP) — "of predicted positives, how many were right?" Important when false positives are costly (spam filter flagging real emails).
- **Recall (sensitivity)** = TP / (TP + FN) — "of actual positives, how many did we catch?" Important when false negatives are costly (cancer screening, fraud).
- **F1** = harmonic mean of precision and recall.
- **ROC-AUC** — ranking quality across thresholds (TPR vs FPR). **PR-AUC** is better for heavy imbalance.
- **Log loss** — penalises confident wrong probabilities.
- The **decision threshold** (default 0.5) can be tuned to trade precision vs recall.

### Regression
- **MAE** — average absolute error, robust to outliers, same units.
- **MSE / RMSE** — penalises large errors more.
- **R²** — proportion of variance explained.
- **MAPE** — percentage error (beware values near zero).

### Validation strategies
Hold-out, **k-fold cross-validation**, **stratified** k-fold (preserve class ratios), **time-series split** (train on past, validate on future), group k-fold (no user in both train and validation).

## Overfitting, Underfitting and the Bias–Variance Trade-off

- **Underfitting (high bias)** — model too simple; poor on train and test.
- **Overfitting (high variance)** — memorises noise; great on train, poor on test.

```text
Error
  │\                        /  ← validation error
  │ \                     /
  │  \__________________/
  │   \______________________  ← training error
  └──────────────────────────── model complexity
     underfit   sweet spot   overfit
```

### Fixing overfitting
More data, data augmentation, simpler model, **regularization** (L1/L2), early stopping, dropout, pruning trees / limiting depth, ensembling (bagging), cross-validation for model selection, feature selection.

### Regularization
- **L1 (Lasso)** adds `λ·Σ|w|` → drives some weights to exactly zero (feature selection).
- **L2 (Ridge)** adds `λ·Σw²` → shrinks weights smoothly.
- **Elastic Net** combines both.

### Fixing underfitting
More features / better features, more complex model, less regularization, train longer.

### Imbalanced data
Use proper metrics (PR-AUC, F1, recall), class weights, resampling (SMOTE, undersampling), threshold tuning, anomaly detection framing.

## Hyperparameter Tuning and Ensembles

```python
from sklearn.model_selection import RandomizedSearchCV
search = RandomizedSearchCV(
    RandomForestClassifier(),
    {"n_estimators": [100, 300, 500], "max_depth": [None, 10, 20], "min_samples_leaf": [1, 3, 5]},
    n_iter=20, cv=5, scoring="f1", n_jobs=-1,
).fit(X_train, y_train)
search.best_params_
```
Methods: grid search, random search (more efficient), **Bayesian optimisation** (Optuna), Hyperband.

### Ensembles
- **Bagging** — train models on bootstrapped samples in parallel and average → reduces **variance** (Random Forest).
- **Boosting** — train models sequentially, each focusing on previous errors → reduces **bias** (AdaBoost, Gradient Boosting, XGBoost).
- **Stacking** — a meta-model learns how to combine base models.

## Neural Network Fundamentals

A neural network is layers of **neurons**: each computes `output = activation(w · x + b)`.

### Training loop
1. **Forward pass** — compute predictions.
2. **Loss** — measure error (MSE for regression, cross-entropy for classification).
3. **Backpropagation** — compute gradients of the loss w.r.t. every weight using the chain rule.
4. **Optimizer step** — update weights: `w = w − learning_rate × gradient` (SGD, Momentum, **Adam/AdamW**).
5. Repeat over **mini-batches** for many **epochs**.

```python
import torch, torch.nn as nn

model = nn.Sequential(nn.Linear(20, 64), nn.ReLU(), nn.Dropout(0.2), nn.Linear(64, 2))
opt = torch.optim.AdamW(model.parameters(), lr=1e-3)
loss_fn = nn.CrossEntropyLoss()

for epoch in range(10):
    for xb, yb in train_loader:
        opt.zero_grad()
        loss = loss_fn(model(xb), yb)
        loss.backward()          # backprop
        opt.step()               # gradient descent update
```

### Activation functions
- **ReLU** `max(0, x)` — default for hidden layers; cheap, avoids vanishing gradients (can "die").
- **GELU/SiLU** — smooth variants used in Transformers.
- **Sigmoid** — outputs (0,1) for binary probability.
- **Softmax** — converts logits to a probability distribution over classes.
- **Tanh** — (−1, 1), used in older RNNs.

### Key concepts
- **Learning rate** — most important hyperparameter; too high diverges, too low is slow. Schedulers: warmup + cosine decay.
- **Batch size**, **epochs**.
- **Vanishing/exploding gradients** — mitigated by ReLU, good initialisation (He/Xavier), normalization, residual connections, gradient clipping.
- **Batch Norm / Layer Norm** — stabilise and speed up training.
- **Dropout** — randomly zero activations during training (regularization).

# Advanced

## Deep Learning Architectures

### CNNs — Convolutional Neural Networks (vision)
Convolution filters slide over images detecting local patterns (edges → textures → objects); **pooling** downsamples; parameter sharing makes them efficient. Architectures: LeNet, AlexNet, VGG, **ResNet** (residual/skip connections allow very deep networks), EfficientNet. Vision Transformers (ViT) now compete or win at scale.

### RNNs, LSTMs, GRUs (sequences)
Process sequences step by step with a hidden state. Vanilla RNNs suffer vanishing gradients; **LSTM/GRU** add gates to retain long-range information. Limitations: sequential (slow to train), struggle with very long context → replaced by Transformers for most NLP.

### Transformers
Introduced in "Attention Is All You Need" (2017). Core idea: **self-attention** lets every token look at every other token in parallel.

```text
Attention(Q, K, V) = softmax(Q·Kᵀ / √d_k) · V
```
- Each token is projected into **Query, Key, Value** vectors; attention weights = similarity of a token's query with all keys.
- **Multi-head attention** learns different relationships in parallel.
- **Positional encodings** (sinusoidal, learned, RoPE) inject order.
- Blocks: attention + feed-forward + residual connections + layer norm.
- Variants: **encoder-only** (BERT — understanding/classification/embeddings), **decoder-only** (GPT, Claude, Llama — generation), **encoder-decoder** (T5 — translation/summarisation).
- Cost: attention is O(n²) in sequence length → FlashAttention, sparse/linear attention, KV caching.

### Other generative models
- **GANs** — generator vs discriminator adversarial training.
- **VAEs** — learn a latent distribution.
- **Diffusion models** — learn to denoise step by step (Stable Diffusion, image/video generation).

### Transfer learning
Start from a model pre-trained on large data and **fine-tune** on your task — needs far less data and compute. Freeze early layers, train the head, optionally unfreeze gradually.

## MLOps: Deploying and Operating Models

```python
import mlflow, mlflow.sklearn
with mlflow.start_run():
    mlflow.log_params({"n_estimators": 300, "max_depth": 8})
    model.fit(X_train, y_train)
    mlflow.log_metric("f1", f1_score(y_val, model.predict(X_val)))
    mlflow.sklearn.log_model(model, "model", registered_model_name="churn")
```
```python serve.py
from fastapi import FastAPI
import mlflow.pyfunc
app = FastAPI()
model = mlflow.pyfunc.load_model("models:/churn@champion")
@app.post("/predict")
def predict(features: dict): return {"churn_prob": float(model.predict([features])[0])}
```

### Lifecycle
Data versioning → experiment tracking → training pipelines → model registry → deployment → monitoring → retraining.

| Concern | Tools |
|---|---|
| Experiment tracking & registry | MLflow, Weights & Biases |
| Data/pipeline versioning | DVC, lakeFS, Delta Lake |
| Orchestration | Airflow, Kubeflow Pipelines, Prefect, Dagster |
| Feature store | Feast, Tecton |
| Serving | FastAPI, BentoML, KServe, Seldon, Triton, TorchServe, Ray Serve |
| Platforms | SageMaker, Vertex AI, Azure ML, Databricks, OpenShift AI |
| Monitoring | Evidently, Arize, WhyLabs, Prometheus |

### Serving patterns
- **Batch** (score nightly, write to DB) vs **online** (real-time API) vs **streaming** (Kafka/Flink).
- Optimise inference: model quantization, ONNX Runtime, TensorRT, batching, GPU sharing, caching.
- Release safely: **shadow** deployments, canary, A/B tests on business KPIs.

### Monitoring in production
- **Data drift** — input distribution changes (new user demographics).
- **Concept drift** — relationship between inputs and target changes (fraud patterns evolve).
- **Training-serving skew** — features computed differently online vs offline (feature stores help).
- Track latency, throughput, errors, prediction distributions, and delayed ground-truth performance; trigger retraining.

## Responsible AI

- **Bias and fairness** — biased training data produces discriminatory outcomes; measure with fairness metrics across groups (demographic parity, equalized odds), rebalance, audit.
- **Explainability** — feature importance, **SHAP**, LIME, partial dependence plots; required in regulated domains (credit, health).
- **Privacy** — anonymisation, differential privacy, federated learning, data minimisation; GDPR "right to explanation/erasure".
- **Robustness and security** — adversarial examples, data poisoning, model extraction/inversion.
- **Governance** — model cards, datasheets, human oversight, regulations (EU AI Act risk tiers).

```python
import shap
from fairlearn.metrics import MetricFrame, selection_rate
from sklearn.metrics import recall_score

explainer = shap.TreeExplainer(model)
shap.summary_plot(explainer.shap_values(X_test), X_test)          # explainability

mf = MetricFrame(metrics={"recall": recall_score, "selection_rate": selection_rate},
                 y_true=y_test, y_pred=y_pred, sensitive_features=X_test["gender"])
print(mf.by_group)          # compare groups
print(mf.difference())      # fairness gap
```

## Math You Should Be Comfortable With

- **Linear algebra** — vectors, matrices, dot products (similarity), matrix multiplication (layers), eigenvectors (PCA).
- **Calculus** — derivatives, gradients, chain rule (backpropagation).
- **Probability & statistics** — distributions, mean/variance, Bayes' theorem, conditional probability, maximum likelihood, hypothesis tests, confidence intervals, A/B testing.
- **Optimisation** — gradient descent variants, convexity, local minima/saddle points.
- **Information theory** — entropy, cross-entropy (classification loss), KL divergence (distribution distance; used in VAEs and RLHF).

```text
Bayes:          P(A|B) = P(B|A) · P(A) / P(B)
Cross-entropy:  L = −Σ y_i · log(ŷ_i)
Sigmoid:        σ(z) = 1 / (1 + e^(−z))
Softmax:        softmax(z_i) = e^(z_i) / Σ_j e^(z_j)
Cosine sim:     cos(a, b) = a·b / (‖a‖·‖b‖)
```

# Interview Questions

## Beginner

### What is the difference between AI, ML and Deep Learning?
AI is the broad field of making machines perform intelligent tasks. ML is a subset where systems learn patterns from data instead of explicit rules. Deep learning is a subset of ML using multi-layer neural networks, especially effective on unstructured data like images, audio and text.

```python
# Rule-based "AI"
def is_spam(msg): return "free money" in msg.lower()

# Machine learning: learn from labelled data
from sklearn.naive_bayes import MultinomialNB
from sklearn.feature_extraction.text import TfidfVectorizer
vec = TfidfVectorizer(); clf = MultinomialNB().fit(vec.fit_transform(texts), labels)

# Deep learning: neural network learns its own features
import torch.nn as nn
net = nn.Sequential(nn.Embedding(30000, 128), nn.LSTM(128, 64, batch_first=True))
```

### Supervised vs unsupervised learning?
Supervised learning trains on labelled examples to predict a known target (classification, regression). Unsupervised learning finds structure in unlabelled data (clustering, dimensionality reduction, anomaly detection).

```python
from sklearn.ensemble import RandomForestClassifier
from sklearn.cluster import KMeans
RandomForestClassifier().fit(X, y)          # supervised: X + labels y
KMeans(n_clusters=5).fit(X)                 # unsupervised: X only, finds groups
```

### Classification vs regression?
Classification predicts discrete categories (spam/not spam). Regression predicts continuous values (price, temperature). Logistic regression, despite the name, is a classification algorithm.

```python
from sklearn.linear_model import LogisticRegression, LinearRegression
LogisticRegression().fit(X, y_churned).predict_proba(X_new)   # class probability (0/1)
LinearRegression().fit(X, y_price).predict(X_new)             # continuous value (€)
```

### What is overfitting and how do you prevent it?
When a model learns noise in the training data and fails to generalise — high train accuracy, low test accuracy. Prevent with more data, simpler models, regularization, cross-validation, early stopping, dropout, data augmentation and ensembling.

```python
from sklearn.tree import DecisionTreeClassifier
deep = DecisionTreeClassifier().fit(X_train, y_train)
print(deep.score(X_train, y_train), deep.score(X_test, y_test))    # 1.00 vs 0.71 → overfit
pruned = DecisionTreeClassifier(max_depth=4, min_samples_leaf=20).fit(X_train, y_train)
print(pruned.score(X_train, y_train), pruned.score(X_test, y_test))  # 0.86 vs 0.84
```
```python Keras early stopping
model.fit(X, y, validation_split=0.2, epochs=100,
          callbacks=[keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True)])
```

### Why do we split data into train, validation and test sets?
Training data fits the model, validation data tunes hyperparameters and selects models, and the test set gives an unbiased final estimate of performance on unseen data. Using the test set for tuning leaks information and inflates results.

```python
from sklearn.model_selection import train_test_split
X_tmp, X_test, y_tmp, y_test = train_test_split(X, y, test_size=0.15, stratify=y, random_state=42)
X_train, X_val, y_train, y_val = train_test_split(X_tmp, y_tmp, test_size=0.18, stratify=y_tmp, random_state=42)
# tune on X_val, report ONCE on X_test
# Time series: split by time, never randomly
train, test = df[df.date < "2026-07-01"], df[df.date >= "2026-07-01"]
```

### What are features and labels?
Features are the input variables used to make predictions (age, income). The label (target) is the output the model learns to predict (churned or not).

```python
import pandas as pd
df = pd.read_csv("customers.csv")
X = df[["age", "tenure_months", "monthly_spend", "support_tickets"]]   # features
y = df["churned"]                                                     # label
```

### Parameters vs hyperparameters?
Parameters are learned from data during training (weights, biases). Hyperparameters are set before training and control the learning process (learning rate, number of trees, depth, batch size, regularization strength).

```python
from sklearn.model_selection import GridSearchCV
from sklearn.linear_model import LogisticRegression
search = GridSearchCV(LogisticRegression(max_iter=1000), {"C": [0.01, 0.1, 1, 10]}, cv=5)  # hyperparameter C
search.fit(X_train, y_train)
print(search.best_params_)               # chosen hyperparameter
print(search.best_estimator_.coef_)      # learned parameters (weights)
```

## Intermediate

### Precision vs recall — when do you prioritise each?
Precision = TP/(TP+FP), recall = TP/(TP+FN). Prioritise precision when false positives are expensive (blocking legitimate transactions, spam filtering important mail). Prioritise recall when missing positives is dangerous (disease screening, fraud detection). F1 balances both; tune the decision threshold to trade them off.

```python
from sklearn.metrics import precision_recall_curve
prec, rec, thr = precision_recall_curve(y_test, y_prob)
# Fraud/cancer: prioritise recall ≥ 0.9, take the highest threshold that still meets it
i = max(j for j in range(len(thr)) if rec[j] >= 0.9)
threshold = thr[i]
y_pred = (y_prob >= threshold).astype(int)
```

### Why is accuracy a bad metric for imbalanced datasets?
With 99% negatives, predicting "negative" always yields 99% accuracy while catching zero positives. Use precision, recall, F1, PR-AUC, confusion matrices and cost-sensitive metrics instead.

```python
import numpy as np
from sklearn.metrics import accuracy_score, recall_score
y_true = np.array([0] * 990 + [1] * 10)
y_pred = np.zeros(1000)                       # "never fraud"
accuracy_score(y_true, y_pred)                # 0.99
recall_score(y_true, y_pred)                  # 0.0 — catches nothing
```

### Explain the bias-variance trade-off.
Bias is error from overly simplistic assumptions (underfitting); variance is error from sensitivity to training data fluctuations (overfitting). Increasing model complexity lowers bias but raises variance. The goal is the complexity that minimises total generalisation error.

```python
from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import make_pipeline
from sklearn.linear_model import LinearRegression
for degree in [1, 4, 15]:     # high bias → balanced → high variance
    m = make_pipeline(PolynomialFeatures(degree), LinearRegression()).fit(X_train, y_train)
    print(degree, m.score(X_train, y_train), m.score(X_val, y_val))
# 1: 0.55 / 0.53 (underfit)  4: 0.91 / 0.89  15: 0.99 / 0.42 (overfit)
```

### L1 vs L2 regularization?
Both add a penalty on weight size to the loss. L1 (sum of absolute values) produces sparse models by driving some weights to zero — implicit feature selection. L2 (sum of squares) shrinks all weights smoothly and handles correlated features better. Elastic Net combines both.

```python
from sklearn.linear_model import Lasso, Ridge
lasso = Lasso(alpha=0.1).fit(X, y)     # L1
ridge = Ridge(alpha=1.0).fit(X, y)     # L2
print((lasso.coef_ == 0).sum(), "features dropped by L1")
print((ridge.coef_ == 0).sum(), "features dropped by L2")   # usually 0 — just shrunk
```

### Bagging vs boosting?
Bagging trains models independently on bootstrap samples and averages them, reducing variance (Random Forest). Boosting trains models sequentially, each correcting predecessors' errors, reducing bias (XGBoost, LightGBM). Boosting often wins on tabular data but is more prone to overfitting noisy data and needs more tuning.

```python
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
bagging = RandomForestClassifier(n_estimators=500, max_features="sqrt")           # parallel, reduces variance
boosting = HistGradientBoostingClassifier(learning_rate=0.05, max_iter=500,      # sequential, reduces bias
                                          early_stopping=True)
# XGBoost / LightGBM: xgboost.XGBClassifier(n_estimators=800, learning_rate=0.05, max_depth=6)
```

### What is data leakage?
When information unavailable at prediction time leaks into training — e.g., fitting a scaler on the full dataset, features derived from the target, future data in time series, or duplicate records across splits. It produces unrealistically good offline metrics that collapse in production.

```python
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score
# ❌ scaler sees all data, then CV
X_scaled = StandardScaler().fit_transform(X)
# ✅ preprocessing inside the pipeline → fit on each training fold only
pipe = Pipeline([("scale", StandardScaler()), ("clf", LogisticRegression())])
cross_val_score(pipe, X, y, cv=5)
# ❌ feature "refund_issued" when predicting "will_complain" — only known afterwards
```

### How does gradient descent work?
It iteratively updates parameters in the direction opposite the gradient of the loss to reduce it: `w ← w − η∇L`. Variants: batch, stochastic and mini-batch GD; optimisers like Momentum, RMSProp and Adam adapt step sizes. The learning rate controls step size.

```python
import numpy as np
X = np.c_[np.ones(100), np.random.rand(100)]; y = 4 + 3 * X[:, 1] + np.random.randn(100) * 0.1
w, lr = np.zeros(2), 0.5
for _ in range(1000):
    grad = 2 / len(y) * X.T @ (X @ w - y)   # ∇ of mean squared error
    w -= lr * grad                          # step against the gradient
print(w)   # ≈ [4, 3]
```

### What is cross-validation?
A technique that splits data into k folds, trains on k−1 and validates on the remaining fold, rotating k times and averaging scores. It gives a more reliable estimate than a single split and is used for model selection and tuning.

```python
from sklearn.model_selection import StratifiedKFold, TimeSeriesSplit, cross_val_score
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=0)
scores = cross_val_score(model, X, y, cv=cv, scoring="roc_auc")
print(scores.mean(), scores.std())
cross_val_score(model, X_ts, y_ts, cv=TimeSeriesSplit(n_splits=5))   # time-ordered folds
```

## Advanced

### Explain backpropagation.
After a forward pass computes the loss, backpropagation applies the chain rule from the output layer backwards to compute the gradient of the loss with respect to each weight, reusing intermediate results. The optimiser then uses these gradients to update weights.

```python
import torch
x = torch.tensor([2.0]); y = torch.tensor([10.0])
w = torch.tensor([1.0], requires_grad=True); b = torch.tensor([0.0], requires_grad=True)
loss = ((w * x + b - y) ** 2).mean()   # forward pass
loss.backward()                         # backprop: chain rule
print(w.grad, b.grad)                   # dL/dw = 2(wx+b−y)·x = -32, dL/db = -16
with torch.no_grad(): w -= 0.01 * w.grad; b -= 0.01 * b.grad
```

### What is the vanishing gradient problem and how is it solved?
In deep networks, gradients multiplied through many layers with small derivatives (sigmoid/tanh) shrink toward zero, so early layers barely learn. Solutions: ReLU-family activations, proper initialisation (He/Xavier), batch/layer normalisation, residual connections, LSTM/GRU gates for sequences, and gradient clipping for the exploding counterpart.

```python
import torch.nn as nn
deep_sigmoid = nn.Sequential(*[m for _ in range(20) for m in (nn.Linear(64, 64), nn.Sigmoid())])  # gradients vanish

class ResBlock(nn.Module):                       # fixes: ReLU, BatchNorm, residual connections
    def __init__(self, d):
        super().__init__(); self.f = nn.Sequential(nn.Linear(d, d), nn.BatchNorm1d(d), nn.ReLU(), nn.Linear(d, d))
    def forward(self, x): return x + self.f(x)   # skip path lets gradients flow
```

### How does self-attention work in Transformers?
Each token embedding is projected into query, key and value vectors. Attention scores are the scaled dot products of a token's query with all keys, normalised with softmax, then used to weight the values. Multiple heads capture different relationships. This lets every token incorporate context from the entire sequence in parallel.

```python
import torch, torch.nn.functional as F
def self_attention(x, Wq, Wk, Wv):
    Q, K, V = x @ Wq, x @ Wk, x @ Wv                         # (seq, d)
    scores = Q @ K.T / K.shape[-1] ** 0.5                     # scaled dot product
    mask = torch.triu(torch.ones_like(scores), 1).bool()      # causal mask (decoder)
    weights = F.softmax(scores.masked_fill(mask, float("-inf")), dim=-1)
    return weights @ V                                        # weighted mix of values
x = torch.randn(5, 16); W = [torch.randn(16, 16) for _ in range(3)]
out = self_attention(x, *W)                                   # (5, 16)
```

### BERT vs GPT?
Both are Transformers. BERT is an encoder trained with masked language modelling (bidirectional context) — suited to understanding tasks like classification, NER and embeddings. GPT is a decoder trained autoregressively to predict the next token (causal attention) — suited to text generation.

```python
from transformers import pipeline
fill = pipeline("fill-mask", model="bert-base-uncased")          # encoder: understands context both ways
fill("The capital of France is [MASK].")[0]["token_str"]           # 'paris'

gen = pipeline("text-generation", model="gpt2")                   # decoder: predicts the next token
gen("The capital of France is", max_new_tokens=5)[0]["generated_text"]
```

### How would you deploy and monitor an ML model in production?
Package the model with its preprocessing (pipeline) and version it in a registry; serve via batch jobs or an online API (FastAPI/KServe) with autoscaling; roll out with shadow/canary tests; monitor latency, errors, input data drift, prediction distribution and delayed ground-truth metrics; alert and trigger retraining pipelines; ensure feature parity between training and serving.

```yaml KServe InferenceService
apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata: { name: churn }
spec:
  predictor:
    minReplicas: 2
    canaryTrafficPercent: 10           # new version gets 10% of traffic
    model:
      modelFormat: { name: sklearn }
      storageUri: s3://models/churn/v7
```
```python Log predictions for monitoring
logger.info({"model": "churn:v7", "features": features, "prob": prob, "request_id": rid})
```

### What is data drift vs concept drift?
Data drift: the distribution of input features changes (new customer segment). Concept drift: the relationship between inputs and the target changes (fraudsters change tactics), so the same inputs now map to different outcomes. Both degrade model performance and require monitoring and retraining.

```python
from scipy.stats import ks_2samp
stat, p = ks_2samp(train_df["monthly_spend"], last_week_df["monthly_spend"])
if p < 0.01: alert("Data drift on monthly_spend")
# Concept drift shows up as falling live performance once labels arrive
if rolling_recall(window="7d") < 0.75: alert("Concept drift: recall dropped")
```

### How do you explain a model's predictions?
Global: feature importance, permutation importance, partial dependence plots. Local: SHAP values (game-theory attributions per prediction), LIME (local surrogate models), counterfactual explanations. Prefer inherently interpretable models when regulations require it.

```python
import shap
from sklearn.inspection import permutation_importance
imp = permutation_importance(model, X_val, y_val, n_repeats=10)       # global
print(sorted(zip(imp.importances_mean, X_val.columns), reverse=True)[:5])
explainer = shap.Explainer(model, X_train)
sv = explainer(X_val.iloc[[0]])                                       # local: one prediction
shap.plots.waterfall(sv[0])
```

# Scenario Questions

## Beginner

### Your fraud model has 99.5% accuracy, but the business says it catches almost no fraud. What's wrong?
The classes are **imbalanced**: if 0.5% of transactions are fraud, predicting "not fraud" every time scores 99.5% accuracy. Use precision, recall, F1, PR-AUC and a confusion matrix. Handle the imbalance with class weights, resampling (SMOTE or undersampling) and **threshold tuning** based on the business cost of false negatives versus false positives.

```python
from sklearn.metrics import classification_report
print(classification_report(y_test, model.predict(X_test)))   # fraud recall 0.04
model = LGBMClassifier(class_weight="balanced").fit(X_train, y_train)   # or SMOTE / focal loss
y_pred = (model.predict_proba(X_test)[:, 1] > 0.2).astype(int)          # lower threshold for recall
```

## Intermediate

### The model scored 0.95 AUC offline but performs poorly in production. What could explain it?
- **Data leakage**: features that wouldn't be available at prediction time, a target-derived feature, or a random split on time-series data.
- **Train/serve skew**: the feature pipeline differs between training and serving.
- **Distribution shift**: new users, seasonality.
- A label definition mismatch.

Fixes: time-based splits, a shared feature store or pipeline, and monitoring of the input and prediction distributions (PSI, KL divergence).

```python
# Train/serve skew check: same row, two feature pipelines
offline = feature_pipeline_batch(raw_row)
online = requests.post("http://features/online", json=raw_row).json()
diff = {k: (offline[k], online[k]) for k in offline if offline[k] != online[k]}
print(diff)     # e.g. {'avg_spend_30d': (52.1, 0.0)}  ← online feature missing
```

### Training loss keeps going down, but validation loss starts rising after epoch 5. What do you do?
That's **overfitting**. Use early stopping on validation loss, regularisation (L2/weight decay, dropout), more or augmented data, a simpler model, or cross-validation to check. Make sure the validation set reflects production data.

```python
model = keras.Sequential([layers.Dense(128, activation="relu", kernel_regularizer=keras.regularizers.l2(1e-4)),
                          layers.Dropout(0.3), layers.Dense(1, activation="sigmoid")])
model.compile(optimizer="adam", loss="binary_crossentropy")
model.fit(X, y, validation_split=0.2, epochs=50,
          callbacks=[keras.callbacks.EarlyStopping(monitor="val_loss", patience=3, restore_best_weights=True)])
```

## Advanced

### You have to retrain and deploy a model weekly with no regressions. Design the MLOps pipeline.
1. Versioned data and features (DVC, a feature store), and experiment tracking (MLflow).
2. A scheduled training pipeline (Airflow, Kubeflow, SageMaker Pipelines) with data validation (Great Expectations).
3. An evaluation gate against the current model on a fixed holdout set and on slices.
4. A model registry with staging and production stages.
5. Deploy with shadow or canary traffic.
6. Monitor drift, latency and business KPIs, and roll back automatically.

```python Airflow DAG (sketch)
with DAG("churn_weekly", schedule="@weekly", start_date=datetime(2026, 1, 1), catchup=False):
    extract = PythonOperator(task_id="extract", python_callable=extract_features)
    train = PythonOperator(task_id="train", python_callable=train_and_log)          # MLflow run
    evaluate = BranchPythonOperator(task_id="gate", python_callable=lambda: "promote" if new_f1() >= champion_f1() else "stop")
    promote = PythonOperator(task_id="promote", python_callable=set_alias_challenger)  # canary 10%
    stop = EmptyOperator(task_id="stop")
    extract >> train >> evaluate >> [promote, stop]
```

# Tricky Questions

## Beginner

### You scale features with `StandardScaler().fit(X)` on the full dataset, then split into train and test. What's the problem?
**Leakage.** The test set's mean and variance influenced training preprocessing, so test scores come out optimistic. Fit transformers on the **training** data only, ideally inside a `Pipeline` so cross-validation does this correctly per fold.

```python
# ❌
X = StandardScaler().fit_transform(X); X_train, X_test, *_ = train_test_split(X, y)
# ✅
X_train, X_test, y_train, y_test = train_test_split(X, y)
scaler = StandardScaler().fit(X_train)
X_train, X_test = scaler.transform(X_train), scaler.transform(X_test)
```

## Intermediate

### Your model's precision is 0.9 and recall is 0.1. Is it a good model?
It depends on the cost, but it's usually not. When it flags something it's right 90% of the time, but it misses 90% of the positives. For cancer screening or fraud, recall matters more, so lower the threshold. For spam filtering, precision can matter more. Always tie the metric to the business cost.

```python
from sklearn.metrics import f1_score, fbeta_score
f1_score(y_test, y_pred)              # ≈ 0.18
fbeta_score(y_test, y_pred, beta=2)   # recall-weighted ≈ 0.12 → poor for screening
```

### Why might adding more features make a k-NN model worse?
The **curse of dimensionality**: distances become less meaningful as dimensions grow, and irrelevant or noisy features drown out the useful ones. Use feature selection, dimensionality reduction (PCA) and scaling, because k-NN is sensitive to feature scale.

```python
from sklearn.pipeline import make_pipeline
from sklearn.feature_selection import SelectKBest, mutual_info_classif
from sklearn.decomposition import PCA
knn_all = make_pipeline(StandardScaler(), KNeighborsClassifier())
knn_sel = make_pipeline(StandardScaler(), SelectKBest(mutual_info_classif, k=10), KNeighborsClassifier())
knn_pca = make_pipeline(StandardScaler(), PCA(n_components=10), KNeighborsClassifier())
for m in (knn_all, knn_sel, knn_pca): print(cross_val_score(m, X, y, cv=5).mean())
```
