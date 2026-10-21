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

# Intermediate

## Evaluation Metrics

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

### Supervised vs unsupervised learning?
Supervised learning trains on labelled examples to predict a known target (classification, regression). Unsupervised learning finds structure in unlabelled data (clustering, dimensionality reduction, anomaly detection).

### Classification vs regression?
Classification predicts discrete categories (spam/not spam). Regression predicts continuous values (price, temperature). Logistic regression, despite the name, is a classification algorithm.

### What is overfitting and how do you prevent it?
When a model learns noise in the training data and fails to generalise — high train accuracy, low test accuracy. Prevent with more data, simpler models, regularization, cross-validation, early stopping, dropout, data augmentation and ensembling.

### Why do we split data into train, validation and test sets?
Training data fits the model, validation data tunes hyperparameters and selects models, and the test set gives an unbiased final estimate of performance on unseen data. Using the test set for tuning leaks information and inflates results.

### What are features and labels?
Features are the input variables used to make predictions (age, income). The label (target) is the output the model learns to predict (churned or not).

### Parameters vs hyperparameters?
Parameters are learned from data during training (weights, biases). Hyperparameters are set before training and control the learning process (learning rate, number of trees, depth, batch size, regularization strength).

## Intermediate

### Precision vs recall — when do you prioritise each?
Precision = TP/(TP+FP), recall = TP/(TP+FN). Prioritise precision when false positives are expensive (blocking legitimate transactions, spam filtering important mail). Prioritise recall when missing positives is dangerous (disease screening, fraud detection). F1 balances both; tune the decision threshold to trade them off.

### Why is accuracy a bad metric for imbalanced datasets?
With 99% negatives, predicting "negative" always yields 99% accuracy while catching zero positives. Use precision, recall, F1, PR-AUC, confusion matrices and cost-sensitive metrics instead.

### Explain the bias-variance trade-off.
Bias is error from overly simplistic assumptions (underfitting); variance is error from sensitivity to training data fluctuations (overfitting). Increasing model complexity lowers bias but raises variance. The goal is the complexity that minimises total generalisation error.

### L1 vs L2 regularization?
Both add a penalty on weight size to the loss. L1 (sum of absolute values) produces sparse models by driving some weights to zero — implicit feature selection. L2 (sum of squares) shrinks all weights smoothly and handles correlated features better. Elastic Net combines both.

### Bagging vs boosting?
Bagging trains models independently on bootstrap samples and averages them, reducing variance (Random Forest). Boosting trains models sequentially, each correcting predecessors' errors, reducing bias (XGBoost, LightGBM). Boosting often wins on tabular data but is more prone to overfitting noisy data and needs more tuning.

### What is data leakage?
When information unavailable at prediction time leaks into training — e.g., fitting a scaler on the full dataset, features derived from the target, future data in time series, or duplicate records across splits. It produces unrealistically good offline metrics that collapse in production.

### How does gradient descent work?
It iteratively updates parameters in the direction opposite the gradient of the loss to reduce it: `w ← w − η∇L`. Variants: batch, stochastic and mini-batch GD; optimisers like Momentum, RMSProp and Adam adapt step sizes. The learning rate controls step size.

### What is cross-validation?
A technique that splits data into k folds, trains on k−1 and validates on the remaining fold, rotating k times and averaging scores. It gives a more reliable estimate than a single split and is used for model selection and tuning.

## Advanced

### Explain backpropagation.
After a forward pass computes the loss, backpropagation applies the chain rule from the output layer backwards to compute the gradient of the loss with respect to each weight, reusing intermediate results. The optimiser then uses these gradients to update weights.

### What is the vanishing gradient problem and how is it solved?
In deep networks, gradients multiplied through many layers with small derivatives (sigmoid/tanh) shrink toward zero, so early layers barely learn. Solutions: ReLU-family activations, proper initialisation (He/Xavier), batch/layer normalisation, residual connections, LSTM/GRU gates for sequences, and gradient clipping for the exploding counterpart.

### How does self-attention work in Transformers?
Each token embedding is projected into query, key and value vectors. Attention scores are the scaled dot products of a token's query with all keys, normalised with softmax, then used to weight the values. Multiple heads capture different relationships. This lets every token incorporate context from the entire sequence in parallel.

### BERT vs GPT?
Both are Transformers. BERT is an encoder trained with masked language modelling (bidirectional context) — suited to understanding tasks like classification, NER and embeddings. GPT is a decoder trained autoregressively to predict the next token (causal attention) — suited to text generation.

### How would you deploy and monitor an ML model in production?
Package the model with its preprocessing (pipeline) and version it in a registry; serve via batch jobs or an online API (FastAPI/KServe) with autoscaling; roll out with shadow/canary tests; monitor latency, errors, input data drift, prediction distribution and delayed ground-truth metrics; alert and trigger retraining pipelines; ensure feature parity between training and serving.

### What is data drift vs concept drift?
Data drift: the distribution of input features changes (new customer segment). Concept drift: the relationship between inputs and the target changes (fraudsters change tactics), so the same inputs now map to different outcomes. Both degrade model performance and require monitoring and retraining.

### How do you explain a model's predictions?
Global: feature importance, permutation importance, partial dependence plots. Local: SHAP values (game-theory attributions per prediction), LIME (local surrogate models), counterfactual explanations. Prefer inherently interpretable models when regulations require it.

# Scenario Questions

## Beginner

### Your fraud model has 99.5% accuracy, but the business says it catches almost no fraud. What's wrong?
The classes are **imbalanced**: if 0.5% of transactions are fraud, predicting "not fraud" every time scores 99.5% accuracy. Use precision, recall, F1, PR-AUC and a confusion matrix. Handle the imbalance with class weights, resampling (SMOTE or undersampling) and **threshold tuning** based on the business cost of false negatives versus false positives.

## Intermediate

### The model scored 0.95 AUC offline but performs poorly in production. What could explain it?
- **Data leakage**: features that wouldn't be available at prediction time, a target-derived feature, or a random split on time-series data.
- **Train/serve skew**: the feature pipeline differs between training and serving.
- **Distribution shift**: new users, seasonality.
- A label definition mismatch.

Fixes: time-based splits, a shared feature store or pipeline, and monitoring of the input and prediction distributions (PSI, KL divergence).

### Training loss keeps going down, but validation loss starts rising after epoch 5. What do you do?
That's **overfitting**. Use early stopping on validation loss, regularisation (L2/weight decay, dropout), more or augmented data, a simpler model, or cross-validation to check. Make sure the validation set reflects production data.

## Advanced

### You have to retrain and deploy a model weekly with no regressions. Design the MLOps pipeline.
1. Versioned data and features (DVC, a feature store), and experiment tracking (MLflow).
2. A scheduled training pipeline (Airflow, Kubeflow, SageMaker Pipelines) with data validation (Great Expectations).
3. An evaluation gate against the current model on a fixed holdout set and on slices.
4. A model registry with staging and production stages.
5. Deploy with shadow or canary traffic.
6. Monitor drift, latency and business KPIs, and roll back automatically.

# Tricky Questions

## Beginner

### You scale features with `StandardScaler().fit(X)` on the full dataset, then split into train and test. What's the problem?
**Leakage.** The test set's mean and variance influenced training preprocessing, so test scores come out optimistic. Fit transformers on the **training** data only, ideally inside a `Pipeline` so cross-validation does this correctly per fold.

## Intermediate

### Your model's precision is 0.9 and recall is 0.1. Is it a good model?
It depends on the cost, but it's usually not. When it flags something it's right 90% of the time, but it misses 90% of the positives. For cancer screening or fraud, recall matters more, so lower the threshold. For spam filtering, precision can matter more. Always tie the metric to the business cost.

### Why might adding more features make a k-NN model worse?
The **curse of dimensionality**: distances become less meaningful as dimensions grow, and irrelevant or noisy features drown out the useful ones. Use feature selection, dimensionality reduction (PCA) and scaling, because k-NN is sensitive to feature scale.
