import AssignedPlanningDetail from '@/app/components/planning/AssignedPlanningDetail'

export default function EmployeePlanningDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  return <AssignedPlanningDetail basePath="/employee" params={params} />
}
