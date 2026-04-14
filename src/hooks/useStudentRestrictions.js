import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook that applies soft restrictions for student/exam roles:
 * - Disables right-click context menu
 * - Disables Ctrl+C / Cmd+C on the page
 * - Returns a boolean indicating if exports should be hidden
 * 
 * These are soft restrictions — they won't stop a determined user
 * but satisfy the requirement from Ujjwal.
 */
export function useStudentRestrictions() {
  const { userRole } = useAuth();
  const isRestricted = userRole === 'student' || userRole === 'exam';

  useEffect(() => {
    if (!isRestricted) return;

    const handleContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    const handleKeyDown = (e) => {
      // Disable Ctrl+C / Cmd+C (copy)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        return false;
      }
      // Disable Ctrl+S / Cmd+S (save page)
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        return false;
      }
      // Disable Print Screen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRestricted]);

  return { isRestricted, canExport: !isRestricted };
}
