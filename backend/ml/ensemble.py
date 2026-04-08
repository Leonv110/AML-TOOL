"""
AML Ensemble Model — Isolation Forest + K-Means + SHAP Explanations
Provides anomaly scoring for AML transaction monitoring.
"""

import os
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import joblib

# Optional: SHAP for explainability
try:
    import shap
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False


class AMLEnsemble:
    """
    Ensemble model combining:
    1. Isolation Forest (200 estimators, 5% contamination) for anomaly detection
    2. K-Means clustering for behavioral outlier identification
    3. SHAP explanations for feature importance
    """

    MODEL_DIR = os.path.join(os.path.dirname(__file__), 'saved_models')

    FEATURE_COLUMNS = [
        'amount',
        'transaction_frequency_1hr',
        'days_since_last_transaction',
        'user_transaction_count_7d',
        'country_risk_score',        # Engineered: mapped from country_risk_level
        'amount_vs_avg_ratio',       # Engineered: amount / user avg
        'threshold_proximity',       # Engineered: how close to reporting threshold
        'is_round_amount',           # Engineered: binary (e.g. 10000, 50000)
        'hour_of_day',               # Engineered: from transaction_date
        'is_weekend',                # Engineered: from transaction_date
        'degree_centrality',         # From graph analysis (if available)
    ]

    def __init__(self):
        self.isolation_forest = None
        self.kmeans = None
        self.scaler = StandardScaler()
        self._is_trained = False

    # --- Feature Engineering ---
    def engineer_features(self, df):
        """
        Engineer 11 features from raw transaction data.
        Returns a DataFrame with standardized feature columns.
        """
        features = pd.DataFrame(index=df.index)

        # 1. Amount (raw)
        features['amount'] = pd.to_numeric(df.get('amount', 0), errors='coerce').fillna(0)

        # 2. Transaction frequency (1hr window)
        features['transaction_frequency_1hr'] = pd.to_numeric(
            df.get('transaction_frequency_1hr', 0), errors='coerce'
        ).fillna(0)

        # 3. Days since last transaction
        features['days_since_last_transaction'] = pd.to_numeric(
            df.get('days_since_last_transaction', 0), errors='coerce'
        ).fillna(0)

        # 4. User transaction count in 7 days
        features['user_transaction_count_7d'] = pd.to_numeric(
            df.get('user_transaction_count_7d', 0), errors='coerce'
        ).fillna(0)

        # 5. Country risk score (mapped)
        risk_map = {'high': 3, 'medium': 2, 'low': 1}
        features['country_risk_score'] = df.get('country_risk_level', 'low').apply(
            lambda x: risk_map.get(str(x).strip().lower(), 0)
        )

        # 6. Amount vs average ratio
        user_col = 'customer_id' if 'customer_id' in df.columns else 'user_id'
        if user_col in df.columns:
            user_avg = df.groupby(user_col)['amount'].transform(
                lambda x: pd.to_numeric(x, errors='coerce').mean()
            ).fillna(1)
            features['amount_vs_avg_ratio'] = features['amount'] / user_avg.clip(lower=1)
        else:
            features['amount_vs_avg_ratio'] = 1.0

        # 7. Threshold proximity (closeness to common reporting thresholds like 10000, 50000)
        thresholds = [10000, 50000, 100000, 200000]
        features['threshold_proximity'] = features['amount'].apply(
            lambda x: min(abs(x - t) / t for t in thresholds) if x > 0 else 1.0
        )

        # 8. Is round amount
        features['is_round_amount'] = features['amount'].apply(
            lambda x: 1 if x > 0 and x % 1000 == 0 else 0
        )

        # 9. Hour of day
        t_col = 'transaction_date' if 'transaction_date' in df.columns else 'timestamp'
        if t_col in df.columns:
            dt = pd.to_datetime(df[t_col], errors='coerce')
            features['hour_of_day'] = dt.dt.hour.fillna(12)
            features['is_weekend'] = dt.dt.dayofweek.isin([5, 6]).astype(int).fillna(0)
        else:
            features['hour_of_day'] = 12
            features['is_weekend'] = 0

        # 11. Degree centrality (from graph analysis)
        features['degree_centrality'] = pd.to_numeric(
            df.get('degree_centrality', 0), errors='coerce'
        ).fillna(0)

        return features.fillna(0)

    # --- Training ---
    def train(self, df):
        """
        Train the ensemble on a DataFrame of transactions.
        Returns training metrics.
        """
        features = self.engineer_features(df)

        # Scale features
        X = self.scaler.fit_transform(features)

        # 1. Isolation Forest
        self.isolation_forest = IsolationForest(
            n_estimators=200,
            contamination=0.05,
            random_state=42,
            n_jobs=-1,
        )
        if_labels = self.isolation_forest.fit_predict(X)

        # 2. K-Means (find behavioral clusters)
        n_clusters = min(5, max(2, len(df) // 50))
        self.kmeans = KMeans(
            n_clusters=n_clusters,
            random_state=42,
            n_init=10,
        )
        km_labels = self.kmeans.fit_predict(X)

        # Find small clusters (< 5% of data) = outlier clusters
        cluster_counts = pd.Series(km_labels).value_counts(normalize=True)
        outlier_clusters = cluster_counts[cluster_counts < 0.05].index.tolist()

        self._is_trained = True

        # Save model
        os.makedirs(self.MODEL_DIR, exist_ok=True)
        joblib.dump(self.isolation_forest, os.path.join(self.MODEL_DIR, 'isolation_forest.pkl'))
        joblib.dump(self.kmeans, os.path.join(self.MODEL_DIR, 'kmeans.pkl'))
        joblib.dump(self.scaler, os.path.join(self.MODEL_DIR, 'scaler.pkl'))

        anomaly_count = int((if_labels == -1).sum())
        outlier_cluster_count = int(sum(1 for l in km_labels if l in outlier_clusters))

        return {
            'training_samples': len(df),
            'features_used': len(self.FEATURE_COLUMNS),
            'isolation_forest_anomalies': anomaly_count,
            'kmeans_clusters': n_clusters,
            'kmeans_outlier_clusters': len(outlier_clusters),
            'kmeans_outlier_count': outlier_cluster_count,
        }

    # --- Loading ---
    def load(self):
        """Load a previously trained model from disk."""
        try:
            self.isolation_forest = joblib.load(os.path.join(self.MODEL_DIR, 'isolation_forest.pkl'))
            self.kmeans = joblib.load(os.path.join(self.MODEL_DIR, 'kmeans.pkl'))
            self.scaler = joblib.load(os.path.join(self.MODEL_DIR, 'scaler.pkl'))
            self._is_trained = True
            return True
        except Exception:
            return False

    # --- Prediction ---
    def predict(self, df):
        """
        Score transactions. Returns list of dicts with:
        - anomaly_score (float, lower = more anomalous)
        - is_anomaly (bool)
        - cluster_id (int)
        - is_outlier_cluster (bool)
        - risk_level ('HIGH', 'MEDIUM', 'LOW')
        - shap_explanation (dict, if available)
        """
        if not self._is_trained:
            raise ValueError("Model not trained. Call train() or load() first.")

        features = self.engineer_features(df)
        X = self.scaler.transform(features)

        # Isolation Forest scores
        if_scores = self.isolation_forest.score_samples(X)  # Higher = more normal
        if_predictions = self.isolation_forest.predict(X)

        # K-Means clusters
        km_labels = self.kmeans.predict(X)
        cluster_counts = pd.Series(km_labels).value_counts(normalize=True)
        outlier_clusters = set(cluster_counts[cluster_counts < 0.05].index.tolist())

        # SHAP explanations (if available)
        shap_values = None
        if HAS_SHAP and len(X) <= 5000:
            try:
                explainer = shap.TreeExplainer(self.isolation_forest)
                shap_values = explainer.shap_values(X)
            except Exception:
                pass

        results = []
        for i in range(len(df)):
            score = float(if_scores[i])
            is_anomaly = if_predictions[i] == -1
            is_outlier = km_labels[i] in outlier_clusters

            # Combined risk: if either model flags it
            if is_anomaly and is_outlier:
                risk = 'HIGH'
            elif is_anomaly or is_outlier:
                risk = 'MEDIUM'
            else:
                risk = 'LOW'

            result = {
                'anomaly_score': round(score, 4),
                'is_anomaly': bool(is_anomaly),
                'cluster_id': int(km_labels[i]),
                'is_outlier_cluster': bool(is_outlier),
                'risk_level': risk,
            }

            # Add SHAP explanation
            if shap_values is not None:
                feature_importance = {}
                for j, col in enumerate(self.FEATURE_COLUMNS):
                    feature_importance[col] = round(float(shap_values[i][j]), 4)
                # Sort by absolute importance
                result['shap_explanation'] = dict(
                    sorted(feature_importance.items(), key=lambda x: abs(x[1]), reverse=True)[:5]
                )

            results.append(result)

        return results
