import { AppWindowIcon, CodeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function Register() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <Tabs defaultValue="signin">
        <TabsList>
          <TabsTrigger value="signin">Sign In</TabsTrigger>
          <TabsTrigger value="signup">Sign Up</TabsTrigger>
        </TabsList>
        <TabsContent value="signin">
          <Card>
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <CardDescription>Sign in to your account.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid gap-3">
                <Label htmlFor="tabs-demo-name">Name</Label>
                <Input id="tabs-demo-name" defaultValue="Pedro Duarte" />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="tabs-demo-username">Password</Label>
                <Input
                  id="tabs-demo-username"
                  type="password"
                  defaultValue="******"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button>Sign In</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="signup">
          <Card>
            <CardHeader>
              <CardTitle>Sign Up</CardTitle>
              <CardDescription>
                Change your password here. After saving, you&apos;ll be logged
                out.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid gap-3">
                <Label htmlFor="tabs-demo-name">Name</Label>
                <Input id="tabs-demo-name" defaultValue="Pedro Duarte" />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="tabs-demo-username">Username</Label>
                <Input id="tabs-demo-username" defaultValue="@peduarte" />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="tabs-demo-username">Password</Label>
                <Input
                  id="tabs-demo-username"
                  type="password"
                  defaultValue="*******"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button>Sign Up</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
