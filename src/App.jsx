import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import RoleRoute from './components/RoleRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import AdminLogin from './pages/AdminLogin';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import HubPage from './pages/HubPage';
import DashboardShell from './pages/DashboardShell';
import DashboardPage from './pages/DashboardPage';
import CustomerMaster from './pages/CustomerMaster';
import CustomerDirectory from './pages/CustomerDirectory';
import CustomerProfile from './pages/CustomerProfile';
import Screening from './pages/Screening';
import TransactionMonitoring from './pages/TransactionMonitoring';
import AlertReview from './pages/AlertReview';
import Investigations from './pages/Investigations';
import InvestigationWorkspace from './pages/InvestigationWorkspace';
import Reports from './pages/Reports';
import AuditLog from './pages/AuditLog';
import IngestionPage from './pages/IngestionPage';
import AdminPanel from './pages/AdminPanel';

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/admin" element={<AdminLogin />} />
                    
                    {/* Hub — post-login landing (no sidebar) */}
                    <Route path="/hub" element={
                        <ProtectedRoute>
                            <HubPage />
                        </ProtectedRoute>
                    } />

                    {/* Main app with sidebar */}
                    <Route
                        element={
                            <ProtectedRoute>
                                <DashboardShell />
                            </ProtectedRoute>
                        }
                    >
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/admin-portal" element={
                            <AdminRoute>
                                <AdminPanel />
                            </AdminRoute>
                        } />
                        <Route path="/customer-master" element={<CustomerMaster />} />
                        <Route path="/customers" element={<CustomerDirectory />} />
                        <Route path="/customers/:id" element={<CustomerProfile />} />
                        <Route path="/screening" element={<Screening />} />
                        <Route path="/transactions" element={<TransactionMonitoring />} />
                        <Route path="/alerts" element={<AlertReview />} />
                        <Route path="/investigations" element={<Investigations />} />
                        <Route path="/investigations/:case_id" element={<InvestigationWorkspace />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/ingestion" element={
                            <RoleRoute allowed={['admin', 'investigator']}>
                                <IngestionPage />
                            </RoleRoute>
                        } />
                        <Route path="/audit-log" element={<AuditLog />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
