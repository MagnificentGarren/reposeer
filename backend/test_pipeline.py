import json
from app.services.ai_engine import build_inspection_workflow, WorkflowState
from app.services.graph_mapper import DependencyGraphMapper


def run_pipeline_test():
    print("--- 1. Testing Dependency Graph Mapper ---")
    mapper = DependencyGraphMapper()
    
    # Updated mock payload using structured import keys matching AST parser output
    mock_parsed_files = [
        {
            "file_path": "app/api/inspect.py",
            "classes": ["InspectAPI"],
            "functions": ["run_inspect"],
            "imports": [
                {
                    "module": "app.services.ingestion",
                    "name": "IngestionService",
                    "statement": "from app.services.ingestion import IngestionService"
                }
            ]
        },
        {
            "file_path": "app/services/ingestion.py",
            "classes": ["IngestionService"],
            "functions": ["ingest_repo"],
            "imports": []
        }
    ]
    
    graph_results = mapper.build_graph(mock_parsed_files)
    print(f"Total Nodes: {graph_results['total_nodes']}")
    print(f"Total Edges: {graph_results['total_edges']}")
    
    assert graph_results['total_edges'] > 0, "Graph resolution failed: Total edges is 0!"
    print("✅ Dependency Graph Resolution Passed!\n")

    print("--- 2. Testing AI Engine Structured Output (Instructor MD_JSON) ---")
    workflow = build_inspection_workflow()
    
    input_state: WorkflowState = {
        "ast_summary": graph_results,
        "repo_structure": "app/api/inspect.py\napp/services/ingestion.py",
        "report": None
    }
    
    output = workflow.invoke(input_state)
    print("Generated Inspection Report:")
    print(json.dumps(output["report"], indent=2))
    
    assert output["report"] is not None, "AI Report generation returned None!"
    print("✅ AI Engine Schema Generation Passed!\n")


if __name__ == "__main__":
    run_pipeline_test()