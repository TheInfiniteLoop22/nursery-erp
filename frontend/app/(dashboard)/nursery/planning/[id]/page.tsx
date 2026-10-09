import AssignedPlanningDetail from '@/app/components/planning/AssignedPlanningDetail'

export default function NurseryPlanningDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  return <AssignedPlanningDetail basePath="/nursery" params={params} />
}
