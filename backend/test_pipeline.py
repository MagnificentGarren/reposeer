from app.services.ast_parser import PythonASTParser
from app.services.graph_mapper import DependencyGraphMapper


def test_pipeline_builds_dependency_graph_from_parsed_python_files():
    parser = PythonASTParser()
    parsed_files = [
        parser.parse_code(
            "app/api/inspect.py",
            "from app.services.ingestion import IngestionService\n"
            "def run_inspect():\n"
            "    return IngestionService()\n",
        ),
        parser.parse_code(
            "app/services/ingestion.py",
            "class IngestionService:\n"
            "    pass\n",
        ),
    ]

    graph_results = DependencyGraphMapper().build_graph(parsed_files)

    assert graph_results["total_nodes"] == 2
    assert graph_results["total_edges"] == 1
