import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Brain, Search, ChevronLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useRequireRole } from "@/hooks/useRequireRole";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type AppRole = 'student' | 'teacher' | 'admin';

interface UserWithRoles {
  id: string;
  email: string;
  created_at: string;
  role: AppRole;
}

const UserManagement = () => {
  const { isAuthorized, isLoading } = useRequireRole('admin');
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | AppRole>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isAuthorized) {
      fetchUsers();
    }
  }, [isAuthorized]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, created_at');
      
      if (profilesError) throw profilesError;

      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (rolesError) throw rolesError;

      const usersWithRoles: UserWithRoles[] = profiles.map(profile => {
        const roleEntry = userRoles?.find(ur => ur.user_id === profile.id);
        const role = (roleEntry?.role as AppRole) || 'student'; // Default to student if no role found
        
        return {
          id: profile.id,
          email: profile.username || 'No username',
          created_at: profile.created_at,
          role: role
        };
      });

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch users',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    try {
      // Upsert: users can only have one role now, so we update the existing row or insert if missing
      const { error } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role: newRole }, { onConflict: 'user_id' });

      if (error) throw error;

      // Update local state immediately
      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));

      toast({
        title: 'Success',
        description: `Role updated to ${newRole}`
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role',
        variant: 'destructive'
      });
      // Revert/Refetch on error
      await fetchUsers();
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthorized) return null;

  const filteredUsers = users.filter(user => {
    const matchesRole = filter === "all" || user.role === filter;
    const matchesSearch = user.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const getRoleBadgeColor = (role: AppRole) => {
    switch (role) {
      case "admin": return "bg-red-500/10 text-red-500 border-red-500/20";
      case "teacher": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "student": return "bg-green-500/10 text-green-500 border-green-500/20";
      default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed left-0 top-0 h-full w-64 bg-card border-r border-border shadow-soft hidden md:block">
        <div className="p-6">
          <Link to="/dashboard" className="flex items-center gap-2 mb-8">
            <div className="p-2 bg-gradient-hero rounded-lg shadow-medium">
              <Brain className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">EduSync</span>
          </Link>
          
          <Button variant="outline" className="w-full justify-start gap-3 mb-4" onClick={() => navigate("/admin")}>
            <ChevronLeft className="h-5 w-5" />
            Back to Admin
          </Button>
        </div>
      </aside>

      <main className="md:ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2">User Management</h1>
            <p className="text-muted-foreground">Manage platform users and permissions</p>
          </header>

          <Card className="mb-6 shadow-soft">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                      placeholder="Search users by email..." 
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                  {(['all', 'student', 'teacher', 'admin'] as const).map((roleOption) => (
                    <Button 
                      key={roleOption}
                      variant={filter === roleOption ? "default" : "outline"}
                      onClick={() => setFilter(roleOption)}
                      className="capitalize whitespace-nowrap"
                    >
                      {roleOption}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Users ({filteredUsers.length})</CardTitle>
              <CardDescription>Manage user roles and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No users found matching your criteria.
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <div key={user.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold truncate max-w-[200px] md:max-w-none" title={user.email}>{user.email}</h3>
                          <Badge className={getRoleBadgeColor(user.role)} variant="outline">
                            {user.role}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Joined: {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">Change Role:</span>
                        <Select 
                          value={user.role} 
                          onValueChange={(val) => handleRoleChange(user.id, val as AppRole)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="teacher">Teacher</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default UserManagement;
