import tree_sitter_python as tspython  # type: ignore
from tree_sitter import Language, Parser  # type: ignore


def _load_python_language():
    language = tspython.language()
    try:
        return Language(language, "python")
    except TypeError:
        return language


PY_LANGUAGE = _load_python_language()


class PythonASTParser:
    """Statically parses Python code to extract structural metadata using Tree-Sitter."""

    def __init__(self):
        self.parser = Parser()
        if hasattr(self.parser, "set_language"):
            self.parser.set_language(PY_LANGUAGE)
        else:
            self.parser.language = PY_LANGUAGE

    def parse_code(self, file_path: str, code: str) -> dict:
        """Parses source code string and returns extracted classes, functions, and imports."""
        tree = self.parser.parse(bytes(code, "utf-8"))
        root_node = tree.root_node

        classes = []
        functions = []
        imports = []

        for node in root_node.children:
            if node.type in ("import_statement", "import_from_statement"):
                imports.append(self._extract_import(node, code))
            elif node.type == "class_definition":
                classes.append(self._extract_class(node, code))
            elif node.type == "function_definition":
                functions.append(self._extract_function(node, code))

        return {
            "file_path": file_path,
            "imports": [i for i in imports if i],
            "classes": classes,
            "functions": functions,
        }

    def _extract_import(self, node, code: str) -> dict | None:
        raw_text = code[node.start_byte : node.end_byte].strip()
        if node.type == "import_statement":
            return {"type": "direct", "statement": raw_text}
        elif node.type == "import_from_statement":
            return {"type": "from", "statement": raw_text}
        return None

    def _extract_class(self, node, code: str) -> dict:
        name_node = node.child_by_field_name("name")
        class_name = (
            code[name_node.start_byte : name_node.end_byte]
            if name_node
            else "Unknown"
        )

        methods = []
        body_node = node.child_by_field_name("body")
        if body_node:
            for child in body_node.children:
                if child.type == "function_definition":
                    methods.append(self._extract_function(child, code))

        return {
            "name": class_name,
            "methods": methods,
            "docstring": (
                self._extract_docstring(body_node, code) if body_node else None
            ),
        }

    def _extract_function(self, node, code: str) -> dict:
        name_node = node.child_by_field_name("name")
        func_name = (
            code[name_node.start_byte : name_node.end_byte]
            if name_node
            else "Unknown"
        )

        body_node = node.child_by_field_name("body")
        return {
            "name": func_name,
            "docstring": (
                self._extract_docstring(body_node, code) if body_node else None
            ),
            "start_line": node.start_point[0] + 1,
            "end_line": node.end_point[0] + 1,
        }

    def _extract_docstring(self, body_node, code: str) -> str | None:
        if not body_node or not body_node.children:
            return None

        first_child = body_node.children[0]
        if first_child.type == "expression_statement":
            expr = first_child.children[0] if first_child.children else None
            if expr and expr.type == "string":
                return code[expr.start_byte : expr.end_byte].strip("\"' ")
        return None