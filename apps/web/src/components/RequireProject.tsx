// // components/RequireProject.tsx
// import { useProject } from "../context/use-project";
// import { CreateProjectScreen } from "./CreateProjectScreen";
// // import { LoadingScreen } from "./LoadingScreen";

// export function RequireProject({ children }: { children: React.ReactNode }) {
//   const { isLoading, projects, activeProject } = useProject();

// //   if (isLoading) return <LoadingScreen />;
//   if (projects.length === 0) return <CreateProjectScreen />; // onboarding, not an error
// //   if (!activeProject) return <LoadingScreen />; // briefly settling, e.g. right after fetch

//   return <>{children}</>;
// }