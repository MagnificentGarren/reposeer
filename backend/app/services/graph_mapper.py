import ast
import networkx as nx  # type: ignore


# -------------------------------------------------------------------
# STEP 1: AST Parser (Where Step 3's visitor logic belongs)
# -------------------------------------------------------------------
class ImportVisitor(ast.NodeVisitor):
    """Extracts raw import statements from an AST node tree."""
    def __init__(self):
        self.imports = []

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            self.imports.append({"statement": f"import {alias.name}"})
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        module = node.module or ""
        self.imports.append({"statement": f"from {module}"})
        self.generic_visit(node)


def parse_python_file(file_path: str, code_content: str) -> dict:
    """Parses a single file into the structure expected by DependencyGraphMapper."""
    tree = ast.parse(code_content)
    
    # Extract imports using the visitor
    visitor = ImportVisitor()
    visitor.visit(tree)

    # Simple inspection for functions/classes (can also use AST visitors)
    classes = [n.name for n in ast.walk(tree) if isinstance(n, ast.ClassDef)]
    functions = [n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)]

    return {
        "file_path": file_path,
        "classes": classes,
        "functions": functions,
        "imports": visitor.imports,  # Fed directly into your mapper
    }


# -------------------------------------------------------------------
# STEP 2: Dependency Graph Mapper (Your graph_mapper.py)
# -------------------------------------------------------------------
class DependencyGraphMapper:
    """Builds a directed dependency graph from AST parsed file metadata to analyze coupling and circular imports."""

    def __init__(self):
        self.graph = nx.DiGraph()

    def build_graph(self, parsed_files: list[dict]) -> dict:
        """Constructs nodes and directed edges representing import relationships across the codebase."""
        self.graph.clear()
        file_paths = {f["file_path"] for f in parsed_files}

        # Add nodes for every python file
        for file_info in parsed_files:
            self.graph.add_node(
                file_info["file_path"],
                class_count=len(file_info["classes"]),
                function_count=len(file_info["functions"]),
            )

        # Add directed edges based on import targets
        for file_info in parsed_files:
            source_file = file_info["file_path"]
            for imp in file_info["imports"]:
                target_file = self._resolve_import_to_path(imp["statement"], file_paths)
                if target_file and target_file != source_file:
                    self.graph.add_edge(source_file, target_file)

        circular_dependencies = self._find_circular_dependencies()

        return {
            "total_nodes": self.graph.number_of_nodes(),
            "total_edges": self.graph.number_of_edges(),
            "circular_dependencies": circular_dependencies,
            "coupling_scores": self._calculate_coupling(),
            "scores": self._calculate_architecture_scores(parsed_files, circular_dependencies),
        }

    def _calculate_architecture_scores(
        self, parsed_files: list[dict], circular_dependencies: list[list[str]]
    ) -> dict[str, int]:
        """Calculate transparent structural scores without an external AI call."""
        file_count = max(len(parsed_files), 1)
        average_imports = sum(len(file_info["imports"]) for file_info in parsed_files) / file_count
        average_classes = sum(len(file_info["classes"]) for file_info in parsed_files) / file_count
        average_functions = sum(len(file_info["functions"]) for file_info in parsed_files) / file_count

        coupling_penalty = min(
            100,
            round(average_imports * 12 + len(circular_dependencies) * 20),
        )
        dependency_health = 100 - coupling_penalty
        maintainability = max(0, 100 - round(coupling_penalty * 0.55) - round(average_classes * 4))
        testability = max(0, 100 - round(average_classes * 3) - round(average_functions * 1.5))

        return {
            "overall": round((maintainability + dependency_health + testability) / 3),
            "maintainability": maintainability,
            "dependency_health": dependency_health,
            "testability": testability,
        }

    def _resolve_import_to_path(self, import_stmt: str, known_paths: set[str]) -> str | None:
        """Attempts to match an import statement to a known internal repository file path."""
        # 1. Extract the module path from "from X import Y" or "import X"
        stmt = import_stmt.strip()
        if stmt.startswith("from "):
            # "from app.services.ingestion import IngestionService" -> "app.services.ingestion"
            clean_stmt = stmt.split()[1]
        elif stmt.startswith("import "):
            # "import app.services.ingestion" -> "app.services.ingestion"
            clean_stmt = stmt.split()[1].split(",")[0]
        else:
            clean_stmt = stmt

        parts = clean_stmt.split(".")

        # Strip top-level namespace roots if present
        if parts and parts[0] in ("app", "src"):
            parts = parts[1:]

        # Convert to POSIX path format
        relative_as_path = "/".join(parts) + ".py"

        # 2. Match against normalized known paths
        for known in known_paths:
            normalized_known = known.replace("\\", "/")
            if normalized_known.endswith(relative_as_path):
                return known

        return None

    def _find_circular_dependencies(self) -> list[list[str]]:
        """Identifies circular dependency loops in the directed graph."""
        try:
            return list(nx.simple_cycles(self.graph))
        except Exception:
            return []

    def _calculate_coupling(self) -> dict[str, dict[str, int]]:
        """Calculates in-degree (afferent) and out-degree (efferent) coupling per module."""
        coupling_data = {}
        for node in self.graph.nodes():
            coupling_data[node] = {
                "in_degree": self.graph.in_degree(node),
                "out_degree": self.graph.out_degree(node),
            }
        return coupling_data