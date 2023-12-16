//
//  FamilyFeudApp.swift
//  FamilyFeud
//
//  Created by Cameron Slash on 11/30/23.
//

import FeudKit
import SwiftUI

@main
struct FamilyFeudApp: App {
    var body: some Scene {
        WindowGroup(id: "Management") {
            ManagementWindow()
        }
        .windowResizability(.contentSize)
        
        WindowGroup(id: "Game") {
            GameWindow()
        }
    }
}
