import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserCog, ShieldCheck } from "lucide-react";

export default function TeacherAdmin() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h2 className="text-3xl md:text-4xl font-bold">Teacher & Admin Overview</h2>
          <p className="text-muted-foreground mt-2">Management tools for streamlined learning operations</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="hover:shadow-elegant transition-all">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-3">
                <UserCog className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Teacher Management</CardTitle>
              <CardDescription>Class rosters, session scheduling, assignments, and feedback.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm">View Teacher Dashboard</Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-elegant transition-all">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-3">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Admin Controls</CardTitle>
              <CardDescription>User roles, analytics, and platform settings in one place.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm">View Admin Dashboard</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
