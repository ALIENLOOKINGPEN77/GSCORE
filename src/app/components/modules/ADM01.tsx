// /app/components/modules/ADM01.tsx
// ADM01 — Role Administration Module
// This module allows administrators to manage user roles and permissions

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { 
  Shield, 
  Users, 
  Settings, 
  Eye, 
  Edit3, 
  Trash2, 
  Plus, 
  Search, 
  AlertCircle, 
  CheckCircle, 
  UserCheck,
  UserX,
  Clock,
  RefreshCw
} from "lucide-react";
import { useAuth } from "../auth-context";
import { 
  fetchAllRoles,
  fetchUserRoleAssignments,
  assignRoleToUser,
  removeRoleFromUser,
  subscribeToRoles,
  subscribeToUserRoleAssignments,
  createInitialAdmin,
  type Role,
  type UserRoleInfo
} from "../../lib/firebase/roles";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase/client";

// Types for the admin interface
interface FirebaseUser {
  uid: string;
  email: string;
  displayName?: string;
  disabled: boolean;
  emailVerified: boolean;
  creationTime: string;
  lastSignInTime?: string;
}

interface UserWithRole extends FirebaseUser {
  roleInfo?: UserRoleInfo;
  roleData?: Role;
}

// Component states
type ViewMode = 'users' | 'roles' | 'assignments';
type ActionState = 'idle' | 'loading' | 'success' | 'error';

export default function ADM01Module() {
  const { user } = useAuth();
  
  // Main data states
  const [users, setUsers] = useState<FirebaseUser[]>([]);
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [assignments, setAssignments] = useState<UserRoleInfo[]>([]);
  
  // UI states
  const [viewMode, setViewMode] = useState<ViewMode>('users');
  const [loading, setLoading] = useState(true);
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Modal and interaction states
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Initial admin setup
  const [showInitialSetup, setShowInitialSetup] = useState(false);
  const [initialAdminEmail, setInitialAdminEmail] = useState('');

  const [setupKey, setSetupKey] = useState('');

  // Load initial data on component mount
  useEffect(() => {
    console.log("[ADM01] Module mounted — Role Administration");
    loadAllData();
  }, []);

  // Subscribe to real-time updates for roles and assignments
  useEffect(() => {
    const unsubscribeRoles = subscribeToRoles((newRoles) => {
      console.log('[ADM01] Roles updated:', Object.keys(newRoles));
      setRoles(newRoles);
    });

    const unsubscribeAssignments = subscribeToUserRoleAssignments((newAssignments) => {
      console.log('[ADM01] Assignments updated:', newAssignments.length);
      setAssignments(newAssignments);
    });

    return () => {
      unsubscribeRoles();
      unsubscribeAssignments();
    };
  }, []);

  // Load all required data for the admin interface
  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[ADM01] Loading admin data...');
      
      // Load users from Firebase Auth (via Firestore collection for demo)
      // In real implementation, you'd use Firebase Admin SDK to list users
      // For now, we'll read from a users collection or show assigned users
      const [rolesData, assignmentsData] = await Promise.all([
        fetchAllRoles(),
        fetchUserRoleAssignments()
      ]);
      
      // Mock users data - in real implementation, this would come from Firebase Admin SDK
      // For now, we'll create user entries based on role assignments and current user
      const mockUsers: FirebaseUser[] = [
        {
          uid: user?.uid || 'current-user',
          email: user?.email || 'current@example.com',
          displayName: user?.displayName || undefined,
          disabled: false,
          emailVerified: true,
          creationTime: new Date().toISOString(),
          lastSignInTime: new Date().toISOString()
        }
      ];
      
      // Add users from assignments who aren't already in the list
      assignmentsData.forEach(assignment => {
        if (!mockUsers.find(u => u.uid === assignment.userId)) {
          mockUsers.push({
            uid: assignment.userId,
            email: assignment.userEmail || `user-${assignment.userId}@company.com`,
            displayName: assignment.userName,
            disabled: false,
            emailVerified: true,
            creationTime: new Date().toISOString()
          });
        }
      });
      
      setRoles(rolesData);
      setAssignments(assignmentsData);
      setUsers(mockUsers);
      
      console.log('[ADM01] Data loaded successfully');
    } catch (err) {
      console.error('[ADM01] Error loading data:', err);
      setError('Error al cargar los datos de administración');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Combine users with their role information
  const usersWithRoles = useMemo((): UserWithRole[] => {
    return users.map(user => {
      const roleAssignment = assignments.find(a => a.userId === user.uid);
      const roleData = roleAssignment ? roles[roleAssignment.roleId] : undefined;
      
      return {
        ...user,
        roleInfo: roleAssignment,
        roleData
      };
    });
  }, [users, assignments, roles]);

  // Filter users based on search term
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return usersWithRoles;
    
    return usersWithRoles.filter(user => 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.roleData?.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [usersWithRoles, searchTerm]);

  // Handle role assignment
  const handleAssignRole = useCallback(async () => {
    if (!selectedUser || !selectedRole) return;
    
    setActionState('loading');
    try {
      await assignRoleToUser(selectedUser.uid, selectedRole);
      setSuccessMessage(`Role asignado correctamente a ${selectedUser.email}`);
      setActionState('success');
      setShowAssignModal(false);
      setSelectedUser(null);
      setSelectedRole('');
      
      // Clear success message after delay
      setTimeout(() => {
        setSuccessMessage(null);
        setActionState('idle');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar el rol');
      setActionState('error');
      setTimeout(() => {
        setActionState('idle');
        setError(null);
      }, 5000);
    }
  }, [selectedUser, selectedRole]);

  // Handle role removal
  const handleRemoveRole = useCallback(async (user: UserWithRole) => {
    if (!user.roleInfo) return;
    
    setActionState('loading');
    try {
      await removeRoleFromUser(user.uid);
      setSuccessMessage(`Role removido de ${user.email}`);
      setActionState('success');
      
      setTimeout(() => {
        setSuccessMessage(null);
        setActionState('idle');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al remover el rol');
      setActionState('error');
      setTimeout(() => {
        setActionState('idle');
        setError(null);
      }, 5000);
    }
  }, []);

  // Handle initial admin creation
  const handleCreateInitialAdmin = useCallback(async () => {
    if (!initialAdminEmail.trim()) return;
    
    setActionState('loading');
    try {
      await createInitialAdmin(initialAdminEmail, setupKey);
      setSuccessMessage('Administrador inicial creado correctamente');
      setActionState('success');
      setShowInitialSetup(false);
      setInitialAdminEmail('');
      
      setTimeout(() => {
        setSuccessMessage(null);
        setActionState('idle');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el administrador inicial');
      setActionState('error');
      setTimeout(() => {
        setActionState('idle');
        setError(null);
      }, 5000);
    }
  }, [initialAdminEmail]);

  // Render role assignment modal
  const renderAssignRoleModal = () => {
    if (!showAssignModal || !selectedUser) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold mb-4">
            Asignar Rol a {selectedUser.email}
          </h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar Rol
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Seleccione un rol --</option>
              {Object.entries(roles).map(([roleId, role]) => (
                <option key={roleId} value={roleId}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          {selectedRole && (
            <div className="mb-4 p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-600">
                <strong>Descripción:</strong> {roles[selectedRole]?.description || 'Sin descripción'}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Módulos:</strong> {Object.keys(roles[selectedRole]?.modules || {}).length} módulos
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleAssignRole}
              disabled={!selectedRole || actionState === 'loading'}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {actionState === 'loading' ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  Asignando...
                </>
              ) : (
                <>
                  <UserCheck size={16} />
                  Asignar Rol
                </>
              )}
            </button>
            <button
              onClick={() => {
                setShowAssignModal(false);
                setSelectedUser(null);
                setSelectedRole('');
              }}
              disabled={actionState === 'loading'}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render users table
  const renderUsersTable = () => (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Gestión de Usuarios</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Buscar usuarios..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowInitialSetup(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2"
            >
              <Plus size={16} />
              Admin Inicial
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4 font-medium text-gray-900">Usuario</th>
              <th className="text-left p-4 font-medium text-gray-900">Email</th>
              <th className="text-left p-4 font-medium text-gray-900">Rol Actual</th>
              <th className="text-left p-4 font-medium text-gray-900">Asignado</th>
              <th className="text-center p-4 font-medium text-gray-900">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.uid} className="hover:bg-gray-50">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                      user.roleInfo ? 'bg-green-500' : 'bg-gray-400'
                    }`}>
                      {user.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {user.displayName || user.email.split('@')[0]}
                      </p>
                      <p className="text-sm text-gray-500">
                        {user.emailVerified ? 'Verificado' : 'No verificado'}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-gray-900">{user.email}</td>
                <td className="p-4">
                  {user.roleData ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                      {user.roleData.label}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-gray-100 text-gray-600">
                      Sin rol
                    </span>
                  )}
                </td>
                <td className="p-4">
                  {user.roleInfo && (
                    <div className="text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        {user.roleInfo.assignedAt.toDate().toLocaleDateString('es-ES')}
                      </div>
                    </div>
                  )}
                </td>
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setShowAssignModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 p-1"
                      title={user.roleInfo ? 'Cambiar rol' : 'Asignar rol'}
                    >
                      <UserCheck size={16} />
                    </button>
                    {user.roleInfo && (
                      <button
                        onClick={() => handleRemoveRole(user)}
                        disabled={actionState === 'loading'}
                        className="text-red-600 hover:text-red-800 p-1 disabled:opacity-50"
                        title="Remover rol"
                      >
                        <UserX size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Render roles overview
  const renderRolesOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Object.entries(roles).map(([roleId, role]) => {
        const assignedCount = assignments.filter(a => a.roleId === roleId).length;
        
        return (
          <div key={roleId} className="bg-white rounded-lg border shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">{role.label}</h4>
              <Shield className="text-blue-500" size={20} />
            </div>
            
            <p className="text-gray-600 text-sm mb-4">
              {role.description || 'Sin descripción disponible'}
            </p>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Módulos:</span>
                <span className="font-medium">{Object.keys(role.modules).length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Usuarios asignados:</span>
                <span className="font-medium">{assignedCount}</span>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-1">
                {Object.entries(role.modules).slice(0, 3).map(([module, permission]) => (
                  <span
                    key={module}
                    className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                      permission === 'admin' ? 'bg-red-100 text-red-800' :
                      permission === 'rw' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}
                  >
                    {module}
                  </span>
                ))}
                {Object.keys(role.modules).length > 3 && (
                  <span className="text-xs text-gray-500">
                    +{Object.keys(role.modules).length - 3} más
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // Render initial admin setup modal
  const renderInitialSetupModal = () => {
    if (!showInitialSetup) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold mb-4">
            Crear Administrador Inicial
          </h3>
          
          <p className="text-sm text-gray-600 mb-4">
            Ingrese el email del usuario que será el primer administrador del sistema.
            Este usuario tendrá acceso completo a todos los módulos.
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email del Administrador
            </label>
            <input
              type="email"
              value={initialAdminEmail}
              onChange={(e) => setInitialAdminEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin@empresa.com"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCreateInitialAdmin}
              disabled={!initialAdminEmail.trim() || !setupKey.trim() || actionState === 'loading'}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {actionState === 'loading' ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  Creando...
                </>
              ) : (
                <>
                  <Shield size={16} />
                  Crear Admin
                </>
              )}
            </button>
            <button
              onClick={() => {
                setShowInitialSetup(false);
                setInitialAdminEmail('');
                setSetupKey('');
              }}
              disabled={actionState === 'loading'}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-4" size={24} />
          <p className="text-gray-600">Cargando panel de administración...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="w-full p-6 bg-gray-50 min-h-full">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-red-100 rounded-lg">
            <Shield className="text-red-600" size={24} />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            ADM01 — Administración de Roles
          </h1>
        </div>
        <p className="text-gray-600">
          Gestión de usuarios, roles y permisos del sistema
        </p>
      </header>

      {/* Status Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
          <CheckCircle size={20} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setViewMode('users')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'users'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Users className="inline mr-2" size={16} />
          Usuarios
        </button>
        <button
          onClick={() => setViewMode('roles')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'roles'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Shield className="inline mr-2" size={16} />
          Roles
        </button>
      </div>

      {/* Main Content */}
      {viewMode === 'users' && renderUsersTable()}
      {viewMode === 'roles' && renderRolesOverview()}

      {/* Modals */}
      {renderAssignRoleModal()}
      {renderInitialSetupModal()}
    </section>
  );
}