import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardShell from './pages/DashboardShell';
import DashboardPage from './pages/DashboardPage';
import CustomerMaster from './pages/CustomerMaster';
import CustomerRisk from './pages/CustomerRisk';
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

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route
                        element={
                            <ProtectedRoute>
                                <DashboardShell />
                            </ProtectedRoute>
                        }
                    >
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/customer-master" element={<CustomerMaster />} />
                        <Route path="/customers" element={<CustomerDirectory />} />
                        <Route path="/customers/:id" element={<CustomerProfile />} />
                        <Route path="/screening" element={<Screening />} />
                        <Route path="/transactions" element={<TransactionMonitoring />} />
                        <Route path="/alerts" element={<AlertReview />} />
                        <Route path="/investigations" element={<Investigations />} />
                        <Route path="/investigations/:case_id" element={<InvestigationWorkspace />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/ingestion" element={<IngestionPage />} />
                        <Route path="/audit-log" element={<AuditLog />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
