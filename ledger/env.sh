# Source this before running any daml command:  source ledger/env.sh
# Pins JDK 17 (Daml 2.9.5 is validated on JDK 17, not the system's JDK 25) and
# puts the Daml SDK + JDK on PATH.
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export PATH="$HOME/.daml/bin:$JAVA_HOME/bin:$PATH"
