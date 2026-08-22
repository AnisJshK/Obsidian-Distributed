import type { WorkflowNodeInput } from "./index";

export class DagValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DagValidationError";
  }
}

export function validateAndSortDag(nodes: WorkflowNodeInput[]): string[] {
  const nodeMap = new Map<string, WorkflowNodeInput>();
  const inDegree = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();

  // Initialize graph
  for (const node of nodes) {
    if (nodeMap.has(node.referenceId)) {
      throw new DagValidationError(`Duplicate referenceId detected: "${node.referenceId}"`);
    }
    nodeMap.set(node.referenceId, node);
    inDegree.set(node.referenceId, 0);
    adjacencyList.set(node.referenceId, []);
  }

  // Build edges
  for (const node of nodes) {
    const deps = node.dependsOn ?? [];
    for (const parentId of deps) {
      if (!nodeMap.has(parentId)) {
        throw new DagValidationError(
          `Node "${node.referenceId}" depends on non-existent referenceId "${parentId}"`
        );
      }
      adjacencyList.get(parentId)!.push(node.referenceId);
      inDegree.set(node.referenceId, (inDegree.get(node.referenceId) || 0) + 1);
    }
  }

  // Kahn's Algorithm
  const queue: string[] = [];
  for (const [refId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(refId);
    }
  }

  const sortedOrder: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sortedOrder.push(current);

    for (const neighbor of adjacencyList.get(current) || []) {
      const updatedDegree = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, updatedDegree);
      if (updatedDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (sortedOrder.length !== nodes.length) {
    throw new DagValidationError(
      "Cyclic dependency detected in workflow DAG. Pipelines must be directed acyclic graphs."
    );
  }

  return sortedOrder;
}