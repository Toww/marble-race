import * as THREE from "three";
import { useState, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useRapier, RigidBody } from "@react-three/rapier";
import { useKeyboardControls } from "@react-three/drei";
import useGame from "./stores/useGame.jsx";

export default function Player() {
    // Refs
    const body = useRef();

    // Hooks
    const { rapier, world } = useRapier();
    const [subscribeKeys, getKeys] = useKeyboardControls();

    const [smoothedCameraPosition] = useState(
        () => new THREE.Vector3(10, 10, 10)
    );
    const [smoothedCameraTarget] = useState(() => new THREE.Vector3());

    const start = useGame((state) => state.start);
    const end = useGame((state) => state.end);
    const restart = useGame((state) => state.restart);
    const blocksCount = useGame((state) => state.blocksCount);

    // Helpers
    const jump = () => {
        const origin = body.current.translation();
        origin.y -= 0.31;

        const direction = { x: 0, y: -1, z: 0 };
        const ray = new rapier.Ray(origin, direction);
        const hit = world.castRay(ray, 10, true);

        // toi stands for Time of Impact
        // (it represents the distance between the ball and the world ground)
        if (hit.toi < 0.15) {
            body.current.applyImpulse({ x: 0, y: 0.5, z: 0 });
        }
    };

    const reset = () => {
        body.current.setTranslation({ x: 0, y: 0, z: 0 });
        body.current.setLinvel({ x: 0, y: 0, z: 0 });
        body.current.setAngvel({ x: 0, y: 0, z: 0 });
    };

    // Effects
    useEffect(() => {
        const unsubscribeReset = useGame.subscribe(
            (state) => state.phase,
            (value) => {
                if (value === "ready") {
                    reset();
                }
            }
        );
        // suscribedKeys returns a function to unsubscribe, so we stock it
        // in a variable and call it on cleanup
        const unsubscribeJump = subscribeKeys(
            (state) => state.jump,
            (isJumping) => {
                if (isJumping) {
                    jump();
                }
            }
        );

        const unsubscribeAny = subscribeKeys(
            (state) => {
                return state;
            },
            (keys) => {
                if (Object.values(keys).includes(true) && !keys.resetKey) {
                    start();
                }
            }
        );

        return () => {
            unsubscribeReset();
            unsubscribeJump();
            unsubscribeAny();
        };
    }, []);

    useFrame((state, delta) => {
        // ----------
        // Controls
        // ----------
        const { forward, rightward, backward, leftward, resetKey } = getKeys();

        const impulse = { x: 0, y: 0, z: 0 };
        const torque = { x: 0, y: 0, z: 0 };

        const impulseStrength = 0.6 * delta;
        const impulseTorque = 0.2 * delta;

        if (forward) {
            impulse.z -= impulseStrength;
            torque.x -= impulseTorque;
        }

        if (rightward) {
            impulse.x += impulseStrength;
            torque.z -= impulseTorque;
        }

        if (backward) {
            impulse.z += impulseStrength;
            torque.x += impulseTorque;
        }

        if (leftward) {
            impulse.x -= impulseStrength;
            torque.z += impulseTorque;
        }

        if (resetKey) {
            restart();
        }

        body.current.applyImpulse(impulse);
        body.current.applyTorqueImpulse(torque);

        // ----------
        // Camera
        // ----------
        const bodyPosition = body.current.translation();
        const cameraPosition = new THREE.Vector3();
        cameraPosition.copy(bodyPosition);
        cameraPosition.z += 2.25;
        cameraPosition.y += 0.65;

        const cameraTarget = new THREE.Vector3();
        cameraTarget.copy(bodyPosition);
        cameraTarget.y += 0.25;

        smoothedCameraPosition.lerp(cameraPosition, 5 * delta);
        smoothedCameraTarget.lerp(cameraTarget, 5 * delta);

        state.camera.position.copy(smoothedCameraPosition);
        state.camera.lookAt(smoothedCameraTarget);

        /**
         * Phases
         */
        if (bodyPosition.z < -(blocksCount * 4 + 2)) {
            end();
        }

        if (bodyPosition.y < -4) {
            restart();
        }
    });

    return (
        <RigidBody
            ref={body}
            friction={1}
            canSleep={false}
            colliders="ball"
            restitution={0.2}
            linearDamping={0.5}
            angularDamping={0.5}
            position={[0, 1, 0]}
        >
            <mesh castShadow>
                <icosahedronGeometry args={[0.3, 1]} />
                <meshStandardMaterial flatShading color="mediumpurple" />
            </mesh>
        </RigidBody>
    );
}
